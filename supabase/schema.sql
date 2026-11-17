-- ============================================================================
-- COTIZADOR DE LEVANTAMIENTOS — ESQUEMA MULTI-TENANT (FASE 1: OPERACIÓN)
-- Base de datos: PostgreSQL / Supabase
-- Zona horaria por defecto: America/Santo_Domingo
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. TIPOS ENUMERADOS (DOMINIO)
-- ============================================================================

do $$ begin
  create type public.rol_empresa as enum ('admin', 'coordinador', 'tecnico');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cargo_personal as enum ('tecnico', 'ingeniero', 'jefe_brigada', 'chofer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_vehiculo as enum ('disponible', 'en_uso', 'mantenimiento');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_trabajo as enum (
    'cotizado',
    'aprobado',
    'programado',
    'en_campo',
    'procesando',
    'entregado',
    'cobrado'
  );
exception when duplicate_object then null; end $$;

-- ============================================================================
-- 2. TABLAS PRINCIPALES (AISLAMIENTO MULTI-TENANT CON FK COMPUESTAS)
-- ============================================================================

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  rnc text not null default '',
  logo_url text,
  zona_horaria text not null default 'America/Santo_Domingo',
  creado_en timestamptz not null default now()
);

create table if not exists public.usuarios_empresa (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  rol public.rol_empresa not null default 'tecnico',
  creado_en timestamptz not null default now(),
  primary key (usuario_id, empresa_id)
);

create table if not exists public.personal (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  cargo public.cargo_personal not null default 'tecnico',
  telefono text not null default '',
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (id, empresa_id)
);

create table if not exists public.vehiculos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  tipo text not null default 'Camioneta 4x4',
  combustible text not null default 'Gasoil',
  rendimiento_km_gal numeric(6, 2) not null default 30.00 check (rendimiento_km_gal > 0),
  estado public.estado_vehiculo not null default 'disponible',
  creado_en timestamptz not null default now(),
  unique (id, empresa_id)
);

create table if not exists public.trabajos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente text not null,
  contacto text not null default '',
  ubicacion_texto text not null default '',
  lat double precision,
  lng double precision,
  tipo_levantamiento text not null default 'Deslinde',
  fecha_prevista date not null,
  fecha_inicio_real timestamptz,
  fecha_fin_real timestamptz,
  estado public.estado_trabajo not null default 'programado',
  responsable_id uuid,
  creado_en timestamptz not null default now(),
  unique (id, empresa_id),
  constraint fk_trabajos_responsable_empresa
    foreign key (responsable_id, empresa_id)
    references public.personal(id, empresa_id)
    on delete set null (responsable_id)
);

create table if not exists public.trabajo_personal (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  trabajo_id uuid not null,
  personal_id uuid not null,
  fecha date not null,
  creado_en timestamptz not null default now(),
  unique (trabajo_id, personal_id, fecha),
  constraint fk_trabajo_personal_trabajo_empresa
    foreign key (trabajo_id, empresa_id)
    references public.trabajos(id, empresa_id)
    on delete cascade,
  constraint fk_trabajo_personal_personal_empresa
    foreign key (personal_id, empresa_id)
    references public.personal(id, empresa_id)
    on delete cascade
);

create table if not exists public.trabajo_vehiculo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  trabajo_id uuid not null,
  vehiculo_id uuid not null,
  fecha date not null,
  creado_en timestamptz not null default now(),
  unique (trabajo_id, vehiculo_id, fecha),
  constraint fk_trabajo_vehiculo_trabajo_empresa
    foreign key (trabajo_id, empresa_id)
    references public.trabajos(id, empresa_id)
    on delete cascade,
  constraint fk_trabajo_vehiculo_vehiculo_empresa
    foreign key (vehiculo_id, empresa_id)
    references public.vehiculos(id, empresa_id)
    on delete cascade
);

create table if not exists public.bitacora (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  trabajo_id uuid not null,
  autor_id uuid not null references auth.users(id) on delete cascade,
  autor_nombre text not null default '',
  fecha_hora timestamptz not null default now(),
  nota text not null,
  foto_url text,
  creado_en timestamptz not null default now(),
  constraint fk_bitacora_trabajo_empresa
    foreign key (trabajo_id, empresa_id)
    references public.trabajos(id, empresa_id)
    on delete cascade
);

-- ============================================================================
-- 3. ÍNDICES
-- ============================================================================

create index if not exists idx_usuarios_empresa_usuario on public.usuarios_empresa(usuario_id);
create index if not exists idx_usuarios_empresa_empresa on public.usuarios_empresa(empresa_id);

create index if not exists idx_personal_empresa on public.personal(empresa_id);
create index if not exists idx_vehiculos_empresa on public.vehiculos(empresa_id);

create index if not exists idx_trabajos_empresa_estado on public.trabajos(empresa_id, estado);
create index if not exists idx_trabajos_empresa_fecha on public.trabajos(empresa_id, fecha_prevista);
create index if not exists idx_trabajos_cliente on public.trabajos(empresa_id, cliente);

create index if not exists idx_trabajo_personal_empresa_fecha on public.trabajo_personal(empresa_id, fecha);
create index if not exists idx_trabajo_personal_personal_fecha on public.trabajo_personal(personal_id, fecha);

create index if not exists idx_trabajo_vehiculo_empresa_fecha on public.trabajo_vehiculo(empresa_id, fecha);
create index if not exists idx_trabajo_vehiculo_vehiculo_fecha on public.trabajo_vehiculo(vehiculo_id, fecha);

create index if not exists idx_bitacora_empresa_trabajo on public.bitacora(empresa_id, trabajo_id, fecha_hora desc);

-- ============================================================================
-- 4. FUNCIONES AUXILIARES, TRIGGERS DE INTEGRIDAD Y RPC
-- ============================================================================

create or replace function public.es_uuid_valido(p_texto text)
returns boolean
language sql
immutable
as $$
  select p_texto is not null
    and p_texto ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

create or replace function public.es_miembro_empresa(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios_empresa ue
    where ue.empresa_id = p_empresa_id
      and ue.usuario_id = auth.uid()
  );
$$;

create or replace function public.tiene_rol_empresa(
  p_empresa_id uuid,
  p_roles public.rol_empresa[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios_empresa ue
    where ue.empresa_id = p_empresa_id
      and ue.usuario_id = auth.uid()
      and ue.rol = any(p_roles)
  );
$$;

-- Impide mover filas entre empresas mediante UPDATE de empresa_id
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

-- Permite a cualquier miembro de la empresa (incluidos técnicos en campo) avanzar el estado operativo
-- sin poder alterar cliente, empresa_id, fecha_prevista ni responsable.
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

-- ============================================================================
-- 5. ACTIVACIÓN DE ROW LEVEL SECURITY (RLS)
-- ============================================================================

alter table public.empresas enable row level security;
alter table public.usuarios_empresa enable row level security;
alter table public.personal enable row level security;
alter table public.vehiculos enable row level security;
alter table public.trabajos enable row level security;
alter table public.trabajo_personal enable row level security;
alter table public.trabajo_vehiculo enable row level security;
alter table public.bitacora enable row level security;

-- ============================================================================
-- 6. POLÍTICAS RLS POR TABLA (AISLAMIENTO ESTRICTO MULTI-TENANT)
-- ============================================================================

drop policy if exists "empresas_select_miembros" on public.empresas;
create policy "empresas_select_miembros"
  on public.empresas for select
  using (public.es_miembro_empresa(id));

drop policy if exists "empresas_update_admin" on public.empresas;
create policy "empresas_update_admin"
  on public.empresas for update
  using (public.tiene_rol_empresa(id, array['admin']::public.rol_empresa[]))
  with check (public.tiene_rol_empresa(id, array['admin']::public.rol_empresa[]));

drop policy if exists "usuarios_empresa_select_propios_o_admin" on public.usuarios_empresa;
create policy "usuarios_empresa_select_propios_o_admin"
  on public.usuarios_empresa for select
  using (
    usuario_id = auth.uid()
    or public.tiene_rol_empresa(empresa_id, array['admin']::public.rol_empresa[])
  );

drop policy if exists "usuarios_empresa_manage_admin" on public.usuarios_empresa;
create policy "usuarios_empresa_manage_admin"
  on public.usuarios_empresa for all
  using (public.tiene_rol_empresa(empresa_id, array['admin']::public.rol_empresa[]))
  with check (public.tiene_rol_empresa(empresa_id, array['admin']::public.rol_empresa[]));

-- PERSONAL
drop policy if exists "personal_select_miembros" on public.personal;
create policy "personal_select_miembros"
  on public.personal for select
  using (public.es_miembro_empresa(empresa_id));

drop policy if exists "personal_insert_coord" on public.personal;
create policy "personal_insert_coord"
  on public.personal for insert
  with check (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]));

drop policy if exists "personal_update_coord" on public.personal;
create policy "personal_update_coord"
  on public.personal for update
  using (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]))
  with check (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]));

drop policy if exists "personal_delete_admin" on public.personal;
create policy "personal_delete_admin"
  on public.personal for delete
  using (public.tiene_rol_empresa(empresa_id, array['admin']::public.rol_empresa[]));

-- VEHICULOS
drop policy if exists "vehiculos_select_miembros" on public.vehiculos;
create policy "vehiculos_select_miembros"
  on public.vehiculos for select
  using (public.es_miembro_empresa(empresa_id));

drop policy if exists "vehiculos_insert_coord" on public.vehiculos;
create policy "vehiculos_insert_coord"
  on public.vehiculos for insert
  with check (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]));

drop policy if exists "vehiculos_update_coord" on public.vehiculos;
create policy "vehiculos_update_coord"
  on public.vehiculos for update
  using (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]))
  with check (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]));

drop policy if exists "vehiculos_delete_admin" on public.vehiculos;
create policy "vehiculos_delete_admin"
  on public.vehiculos for delete
  using (public.tiene_rol_empresa(empresa_id, array['admin']::public.rol_empresa[]));

-- TRABAJOS (edición completa solo admin y coordinador; técnicos usan actualizar_estado_trabajo_campo)
drop policy if exists "trabajos_select_miembros" on public.trabajos;
create policy "trabajos_select_miembros"
  on public.trabajos for select
  using (public.es_miembro_empresa(empresa_id));

drop policy if exists "trabajos_insert_coord" on public.trabajos;
create policy "trabajos_insert_coord"
  on public.trabajos for insert
  with check (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]));

drop policy if exists "trabajos_update_miembros" on public.trabajos;
drop policy if exists "trabajos_update_coord" on public.trabajos;
create policy "trabajos_update_coord"
  on public.trabajos for update
  using (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]))
  with check (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]));

drop policy if exists "trabajos_delete_admin" on public.trabajos;
create policy "trabajos_delete_admin"
  on public.trabajos for delete
  using (public.tiene_rol_empresa(empresa_id, array['admin']::public.rol_empresa[]));

-- TRABAJO_PERSONAL
drop policy if exists "trabajo_personal_select_miembros" on public.trabajo_personal;
create policy "trabajo_personal_select_miembros"
  on public.trabajo_personal for select
  using (public.es_miembro_empresa(empresa_id));

drop policy if exists "trabajo_personal_manage_coord" on public.trabajo_personal;
create policy "trabajo_personal_manage_coord"
  on public.trabajo_personal for all
  using (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]))
  with check (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]));

-- TRABAJO_VEHICULO
drop policy if exists "trabajo_vehiculo_select_miembros" on public.trabajo_vehiculo;
create policy "trabajo_vehiculo_select_miembros"
  on public.trabajo_vehiculo for select
  using (public.es_miembro_empresa(empresa_id));

drop policy if exists "trabajo_vehiculo_manage_coord" on public.trabajo_vehiculo;
create policy "trabajo_vehiculo_manage_coord"
  on public.trabajo_vehiculo for all
  using (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]))
  with check (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]));

-- BITACORA
drop policy if exists "bitacora_select_miembros" on public.bitacora;
create policy "bitacora_select_miembros"
  on public.bitacora for select
  using (public.es_miembro_empresa(empresa_id));

drop policy if exists "bitacora_insert_miembros" on public.bitacora;
create policy "bitacora_insert_miembros"
  on public.bitacora for insert
  with check (
    public.es_miembro_empresa(empresa_id)
    and autor_id = auth.uid()
  );

drop policy if exists "bitacora_delete_autor_o_admin" on public.bitacora;
create policy "bitacora_delete_autor_o_admin"
  on public.bitacora for delete
  using (
    (autor_id = auth.uid() and public.es_miembro_empresa(empresa_id))
    or public.tiene_rol_empresa(empresa_id, array['admin']::public.rol_empresa[])
  );

-- ============================================================================
-- 7. STORAGE BUCKET PARA FOTOS DE BITÁCORA
-- ============================================================================
-- Convención obligatoria de ruta: {empresa_id}/{trabajo_id}/{archivo.jpg}

insert into storage.buckets (id, name, public)
values ('bitacora-fotos', 'bitacora-fotos', false)
on conflict (id) do nothing;

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
