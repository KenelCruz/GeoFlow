-- ============================================================================
-- COTIZADOR DE LEVANTAMIENTOS — ESQUEMA MULTI-TENANT (FASE 1: OPERACIÓN)
-- Base de datos: PostgreSQL / Supabase
-- Zona horaria por defecto: America/Santo_Domingo
-- ============================================================================

-- Habilitar extensión para UUIDs
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
-- 2. TABLAS PRINCIPALES (TODAS MULTI-TENANT POR empresa_id)
-- ============================================================================

-- Empresas (tenants)
create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  rnc text not null default '',
  logo_url text,
  zona_horaria text not null default 'America/Santo_Domingo',
  creado_en timestamptz not null default now()
);

-- Relación usuarios <-> empresas con rol por empresa
create table if not exists public.usuarios_empresa (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  rol public.rol_empresa not null default 'tecnico',
  creado_en timestamptz not null default now(),
  primary key (usuario_id, empresa_id)
);

-- Personal de campo y oficina
create table if not exists public.personal (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  cargo public.cargo_personal not null default 'tecnico',
  telefono text not null default '',
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Vehículos de la empresa
create table if not exists public.vehiculos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  tipo text not null default 'Camioneta 4x4',
  combustible text not null default 'Gasoil',
  rendimiento_km_gal numeric(6, 2) not null default 30.00 check (rendimiento_km_gal > 0),
  estado public.estado_vehiculo not null default 'disponible',
  creado_en timestamptz not null default now()
);

-- Trabajos / levantamientos topográficos
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
  responsable_id uuid references public.personal(id) on delete set null,
  creado_en timestamptz not null default now()
);

-- Asignación de personal a un trabajo por fecha
create table if not exists public.trabajo_personal (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  trabajo_id uuid not null references public.trabajos(id) on delete cascade,
  personal_id uuid not null references public.personal(id) on delete cascade,
  fecha date not null,
  creado_en timestamptz not null default now(),
  unique (trabajo_id, personal_id, fecha)
);

-- Asignación de vehículo a un trabajo por fecha
create table if not exists public.trabajo_vehiculo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  trabajo_id uuid not null references public.trabajos(id) on delete cascade,
  vehiculo_id uuid not null references public.vehiculos(id) on delete cascade,
  fecha date not null,
  creado_en timestamptz not null default now(),
  unique (trabajo_id, vehiculo_id, fecha)
);

-- Bitácora de campo por trabajo
create table if not exists public.bitacora (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  trabajo_id uuid not null references public.trabajos(id) on delete cascade,
  autor_id uuid not null references auth.users(id) on delete cascade,
  fecha_hora timestamptz not null default now(),
  nota text not null,
  foto_url text,
  creado_en timestamptz not null default now()
);

-- ============================================================================
-- 3. ÍNDICES PARA CONSULTAS FRECUENTES Y AGENDA
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
-- 4. FUNCIONES AUXILIARES PARA RLS (SECURITY DEFINER)
-- ============================================================================

-- Verifica si el usuario autenticado pertenece a la empresa indicada
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

-- Verifica si el usuario autenticado tiene uno de los roles permitidos en la empresa
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

-- EMPRESAS: solo miembros ven su empresa; solo admin puede editarla
create policy "empresas_select_miembros"
  on public.empresas for select
  using (public.es_miembro_empresa(id));

create policy "empresas_update_admin"
  on public.empresas for update
  using (public.tiene_rol_empresa(id, array['admin']::public.rol_empresa[]))
  with check (public.tiene_rol_empresa(id, array['admin']::public.rol_empresa[]));

-- USUARIOS_EMPRESA: cada usuario ve sus membresías; admin gestiona la empresa
create policy "usuarios_empresa_select_propios_o_admin"
  on public.usuarios_empresa for select
  using (
    usuario_id = auth.uid()
    or public.tiene_rol_empresa(empresa_id, array['admin']::public.rol_empresa[])
  );

create policy "usuarios_empresa_manage_admin"
  on public.usuarios_empresa for all
  using (public.tiene_rol_empresa(empresa_id, array['admin']::public.rol_empresa[]))
  with check (public.tiene_rol_empresa(empresa_id, array['admin']::public.rol_empresa[]));

-- PERSONAL: miembros leen; admin y coordinador crean/editan/eliminan
create policy "personal_select_miembros"
  on public.personal for select
  using (public.es_miembro_empresa(empresa_id));

create policy "personal_insert_coord"
  on public.personal for insert
  with check (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]));

create policy "personal_update_coord"
  on public.personal for update
  using (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]))
  with check (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]));

create policy "personal_delete_admin"
  on public.personal for delete
  using (public.tiene_rol_empresa(empresa_id, array['admin']::public.rol_empresa[]));

-- VEHICULOS: miembros leen; admin y coordinador crean/editan/eliminan
create policy "vehiculos_select_miembros"
  on public.vehiculos for select
  using (public.es_miembro_empresa(empresa_id));

create policy "vehiculos_insert_coord"
  on public.vehiculos for insert
  with check (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]));

create policy "vehiculos_update_coord"
  on public.vehiculos for update
  using (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]))
  with check (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]));

create policy "vehiculos_delete_admin"
  on public.vehiculos for delete
  using (public.tiene_rol_empresa(empresa_id, array['admin']::public.rol_empresa[]));

-- TRABAJOS: miembros leen; admin y coordinador crean/eliminan; todos los miembros pueden actualizar estado en campo
create policy "trabajos_select_miembros"
  on public.trabajos for select
  using (public.es_miembro_empresa(empresa_id));

create policy "trabajos_insert_coord"
  on public.trabajos for insert
  with check (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]));

create policy "trabajos_update_miembros"
  on public.trabajos for update
  using (public.es_miembro_empresa(empresa_id))
  with check (public.es_miembro_empresa(empresa_id));

create policy "trabajos_delete_admin"
  on public.trabajos for delete
  using (public.tiene_rol_empresa(empresa_id, array['admin']::public.rol_empresa[]));

-- TRABAJO_PERSONAL: miembros leen; admin y coordinador asignan/remueven
create policy "trabajo_personal_select_miembros"
  on public.trabajo_personal for select
  using (public.es_miembro_empresa(empresa_id));

create policy "trabajo_personal_manage_coord"
  on public.trabajo_personal for all
  using (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]))
  with check (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]));

-- TRABAJO_VEHICULO: miembros leen; admin y coordinador asignan/remueven
create policy "trabajo_vehiculo_select_miembros"
  on public.trabajo_vehiculo for select
  using (public.es_miembro_empresa(empresa_id));

create policy "trabajo_vehiculo_manage_coord"
  on public.trabajo_vehiculo for all
  using (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]))
  with check (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]));

-- BITACORA: miembros leen y crean entradas en su empresa; autor o admin puede eliminar
create policy "bitacora_select_miembros"
  on public.bitacora for select
  using (public.es_miembro_empresa(empresa_id));

create policy "bitacora_insert_miembros"
  on public.bitacora for insert
  with check (
    public.es_miembro_empresa(empresa_id)
    and autor_id = auth.uid()
  );

create policy "bitacora_delete_autor_o_admin"
  on public.bitacora for delete
  using (
    autor_id = auth.uid()
    or public.tiene_rol_empresa(empresa_id, array['admin']::public.rol_empresa[])
  );

-- ============================================================================
-- 7. STORAGE BUCKET PARA FOTOS DE BITÁCORA
-- ============================================================================
-- Convención de ruta: {empresa_id}/{trabajo_id}/{archivo.jpg}

insert into storage.buckets (id, name, public)
values ('bitacora-fotos', 'bitacora-fotos', false)
on conflict (id) do nothing;

create policy "bitacora_fotos_select_miembros"
  on storage.objects for select
  using (
    bucket_id = 'bitacora-fotos'
    and public.es_miembro_empresa((storage.foldername(name))[1]::uuid)
  );

create policy "bitacora_fotos_insert_miembros"
  on storage.objects for insert
  with check (
    bucket_id = 'bitacora-fotos'
    and public.es_miembro_empresa((storage.foldername(name))[1]::uuid)
  );
