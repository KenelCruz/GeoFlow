-- ============================================================================
-- MIGRACIÓN 202611170001: Endurecimiento multi-tenant RLS, FK compuestas y Storage
-- Aplicar sobre instalaciones existentes que ejecutaron el schema.sql inicial.
-- ============================================================================

-- 1. Columna autor_nombre en bitacora para mostrar el autor real sin joins privados a auth.users
alter table public.bitacora
  add column if not exists autor_nombre text not null default '';

-- 2. Claves únicas compuestas (id, empresa_id) y FK compuestas entre tablas del mismo tenant
do $$ begin
  alter table public.personal add constraint uq_personal_id_empresa unique (id, empresa_id);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.vehiculos add constraint uq_vehiculos_id_empresa unique (id, empresa_id);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.trabajos add constraint uq_trabajos_id_empresa unique (id, empresa_id);
exception when duplicate_object then null; end $$;

alter table public.trabajos drop constraint if exists trabajos_responsable_id_fkey;
alter table public.trabajos drop constraint if exists fk_trabajos_responsable_empresa;
alter table public.trabajos
  add constraint fk_trabajos_responsable_empresa
  foreign key (responsable_id, empresa_id)
  references public.personal(id, empresa_id)
  on delete set null (responsable_id);

alter table public.trabajo_personal drop constraint if exists trabajo_personal_trabajo_id_fkey;
alter table public.trabajo_personal drop constraint if exists trabajo_personal_personal_id_fkey;
alter table public.trabajo_personal drop constraint if exists fk_trabajo_personal_trabajo_empresa;
alter table public.trabajo_personal drop constraint if exists fk_trabajo_personal_personal_empresa;
alter table public.trabajo_personal
  add constraint fk_trabajo_personal_trabajo_empresa
  foreign key (trabajo_id, empresa_id)
  references public.trabajos(id, empresa_id)
  on delete cascade;
alter table public.trabajo_personal
  add constraint fk_trabajo_personal_personal_empresa
  foreign key (personal_id, empresa_id)
  references public.personal(id, empresa_id)
  on delete cascade;

alter table public.trabajo_vehiculo drop constraint if exists trabajo_vehiculo_trabajo_id_fkey;
alter table public.trabajo_vehiculo drop constraint if exists trabajo_vehiculo_vehiculo_id_fkey;
alter table public.trabajo_vehiculo drop constraint if exists fk_trabajo_vehiculo_trabajo_empresa;
alter table public.trabajo_vehiculo drop constraint if exists fk_trabajo_vehiculo_vehiculo_empresa;
alter table public.trabajo_vehiculo
  add constraint fk_trabajo_vehiculo_trabajo_empresa
  foreign key (trabajo_id, empresa_id)
  references public.trabajos(id, empresa_id)
  on delete cascade;
alter table public.trabajo_vehiculo
  add constraint fk_trabajo_vehiculo_vehiculo_empresa
  foreign key (vehiculo_id, empresa_id)
  references public.vehiculos(id, empresa_id)
  on delete cascade;

alter table public.bitacora drop constraint if exists bitacora_trabajo_id_fkey;
alter table public.bitacora drop constraint if exists fk_bitacora_trabajo_empresa;
alter table public.bitacora
  add constraint fk_bitacora_trabajo_empresa
  foreign key (trabajo_id, empresa_id)
  references public.trabajos(id, empresa_id)
  on delete cascade;

-- 3. Validación de UUID y protección de empresa_id frente a UPDATE cruzados
create or replace function public.es_uuid_valido(p_texto text)
returns boolean
language sql
immutable
as $$
  select p_texto is not null
    and p_texto ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

create or replace function public.proteger_empresa_id()
returns trigger
language plpgsql
as $$
begin
  if new.empresa_id is distinct from old.empresa_id then
    raise exception 'No está permitido cambiar empresa_id de un registro existente.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_empresa_personal on public.personal;
create trigger trg_proteger_empresa_personal
  before update on public.personal
  for each row execute function public.proteger_empresa_id();

drop trigger if exists trg_proteger_empresa_vehiculos on public.vehiculos;
create trigger trg_proteger_empresa_vehiculos
  before update on public.vehiculos
  for each row execute function public.proteger_empresa_id();

drop trigger if exists trg_proteger_empresa_trabajos on public.trabajos;
create trigger trg_proteger_empresa_trabajos
  before update on public.trabajos
  for each row execute function public.proteger_empresa_id();

drop trigger if exists trg_proteger_empresa_trabajo_personal on public.trabajo_personal;
create trigger trg_proteger_empresa_trabajo_personal
  before update on public.trabajo_personal
  for each row execute function public.proteger_empresa_id();

drop trigger if exists trg_proteger_empresa_trabajo_vehiculo on public.trabajo_vehiculo;
create trigger trg_proteger_empresa_trabajo_vehiculo
  before update on public.trabajo_vehiculo
  for each row execute function public.proteger_empresa_id();

drop trigger if exists trg_proteger_empresa_bitacora on public.bitacora;
create trigger trg_proteger_empresa_bitacora
  before update on public.bitacora
  for each row execute function public.proteger_empresa_id();

-- 4. RPC controlada para cambio de estado en campo por técnicos
create or replace function public.actualizar_estado_trabajo_campo(
  p_trabajo_id uuid,
  p_estado public.estado_trabajo,
  p_fecha_inicio_real timestamptz default null,
  p_fecha_fin_real timestamptz default null
)
returns public.trabajos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trabajo public.trabajos;
begin
  select * into v_trabajo
  from public.trabajos
  where id = p_trabajo_id;

  if not found then
    raise exception 'Trabajo no encontrado.';
  end if;

  if not public.es_miembro_empresa(v_trabajo.empresa_id) then
    raise exception 'Acceso denegado: el usuario no pertenece a la empresa.';
  end if;

  update public.trabajos
  set
    estado = p_estado,
    fecha_inicio_real = coalesce(p_fecha_inicio_real, fecha_inicio_real),
    fecha_fin_real = coalesce(p_fecha_fin_real, fecha_fin_real)
  where id = p_trabajo_id
  returning * into v_trabajo;

  return v_trabajo;
end;
$$;

-- 5. Endurecer políticas RLS de trabajos, bitácora y Storage
drop policy if exists "trabajos_update_miembros" on public.trabajos;
drop policy if exists "trabajos_update_coord" on public.trabajos;
create policy "trabajos_update_coord"
  on public.trabajos for update
  using (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]))
  with check (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]));

drop policy if exists "bitacora_delete_autor_o_admin" on public.bitacora;
create policy "bitacora_delete_autor_o_admin"
  on public.bitacora for delete
  using (
    (autor_id = auth.uid() and public.es_miembro_empresa(empresa_id))
    or public.tiene_rol_empresa(empresa_id, array['admin']::public.rol_empresa[])
  );

drop policy if exists "bitacora_fotos_select_miembros" on storage.objects;
create policy "bitacora_fotos_select_miembros"
  on storage.objects for select
  using (
    bucket_id = 'bitacora-fotos'
    and public.es_uuid_valido((storage.foldername(name))[1])
    and public.es_miembro_empresa((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "bitacora_fotos_insert_miembros" on storage.objects;
create policy "bitacora_fotos_insert_miembros"
  on storage.objects for insert
  with check (
    bucket_id = 'bitacora-fotos'
    and public.es_uuid_valido((storage.foldername(name))[1])
    and public.es_uuid_valido((storage.foldername(name))[2])
    and public.es_miembro_empresa((storage.foldername(name))[1]::uuid)
    and exists (
      select 1
      from public.trabajos t
      where t.id = (storage.foldername(name))[2]::uuid
        and t.empresa_id = (storage.foldername(name))[1]::uuid
    )
  );

drop policy if exists "bitacora_fotos_delete_admin_o_autor" on storage.objects;
create policy "bitacora_fotos_delete_admin_o_autor"
  on storage.objects for delete
  using (
    bucket_id = 'bitacora-fotos'
    and public.es_uuid_valido((storage.foldername(name))[1])
    and (
      public.tiene_rol_empresa((storage.foldername(name))[1]::uuid, array['admin']::public.rol_empresa[])
      or (
        owner = auth.uid()
        and public.es_miembro_empresa((storage.foldername(name))[1]::uuid)
      )
    )
  );
