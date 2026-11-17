-- ============================================================================
-- MIGRACIÓN 202611170002: Tablas multi-tenant para módulo Geoespacial y Viáticos
-- Nota: No modifica migraciones previas; agrega poligonos_trabajo y parametros_viaticos
-- con aislamiento estricto por empresa_id, FK compuestas, triggers y RLS.
-- ============================================================================

-- 1. Polígonos KMZ/KML/GeoJSON vinculados opcionalmente a un trabajo
create table if not exists public.poligonos_trabajo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  trabajo_id uuid,
  nombre_archivo text not null,
  formato text not null check (formato in ('kmz', 'kml', 'geojson')),
  geojson jsonb not null,
  area_m2 numeric(14, 2) not null check (area_m2 >= 0),
  perimetro_m numeric(14, 2) not null check (perimetro_m >= 0),
  centroide_lat double precision not null,
  centroide_lng double precision not null,
  provincia_detectada text not null default '',
  creado_por uuid not null references auth.users(id) on delete cascade,
  creado_en timestamptz not null default now(),
  constraint fk_poligonos_trabajo_empresa
    foreign key (trabajo_id, empresa_id)
    references public.trabajos(id, empresa_id)
    on delete set null (trabajo_id)
);

create index if not exists idx_poligonos_trabajo_empresa
  on public.poligonos_trabajo(empresa_id, trabajo_id, creado_en desc);

-- 2. Tabla de tarifas y parámetros de viáticos por empresa
-- Por defecto las tarifas inician en PENDIENTE_CONFIRMAR con monto_rd = null.
create table if not exists public.parametros_viaticos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  codigo text not null,
  concepto text not null,
  unidad text not null,
  monto_rd numeric(12, 2) check (monto_rd is null or monto_rd >= 0),
  estado text not null default 'PENDIENTE_CONFIRMAR'
    check (estado in ('PENDIENTE_CONFIRMAR', 'confirmada')),
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, codigo)
);

create index if not exists idx_parametros_viaticos_empresa
  on public.parametros_viaticos(empresa_id, codigo);

-- 3. Protección contra cambios de empresa_id en UPDATE
drop trigger if exists trg_proteger_empresa_poligonos_trabajo on public.poligonos_trabajo;
create trigger trg_proteger_empresa_poligonos_trabajo
  before update on public.poligonos_trabajo
  for each row execute function public.proteger_empresa_id();

drop trigger if exists trg_proteger_empresa_parametros_viaticos on public.parametros_viaticos;
create trigger trg_proteger_empresa_parametros_viaticos
  before update on public.parametros_viaticos
  for each row execute function public.proteger_empresa_id();

-- 4. Row Level Security (RLS)
alter table public.poligonos_trabajo enable row level security;
alter table public.parametros_viaticos enable row level security;

-- POLÍTICAS: poligonos_trabajo
drop policy if exists "poligonos_trabajo_select_miembros" on public.poligonos_trabajo;
create policy "poligonos_trabajo_select_miembros"
  on public.poligonos_trabajo for select
  using (public.es_miembro_empresa(empresa_id));

drop policy if exists "poligonos_trabajo_insert_coord" on public.poligonos_trabajo;
create policy "poligonos_trabajo_insert_coord"
  on public.poligonos_trabajo for insert
  with check (
    public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[])
    and creado_por = auth.uid()
  );

drop policy if exists "poligonos_trabajo_update_coord" on public.poligonos_trabajo;
create policy "poligonos_trabajo_update_coord"
  on public.poligonos_trabajo for update
  using (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]))
  with check (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]));

drop policy if exists "poligonos_trabajo_delete_admin" on public.poligonos_trabajo;
create policy "poligonos_trabajo_delete_admin"
  on public.poligonos_trabajo for delete
  using (public.tiene_rol_empresa(empresa_id, array['admin']::public.rol_empresa[]));

-- POLÍTICAS: parametros_viaticos
drop policy if exists "parametros_viaticos_select_miembros" on public.parametros_viaticos;
create policy "parametros_viaticos_select_miembros"
  on public.parametros_viaticos for select
  using (public.es_miembro_empresa(empresa_id));

drop policy if exists "parametros_viaticos_insert_coord" on public.parametros_viaticos;
create policy "parametros_viaticos_insert_coord"
  on public.parametros_viaticos for insert
  with check (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]));

drop policy if exists "parametros_viaticos_update_coord" on public.parametros_viaticos;
create policy "parametros_viaticos_update_coord"
  on public.parametros_viaticos for update
  using (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]))
  with check (public.tiene_rol_empresa(empresa_id, array['admin', 'coordinador']::public.rol_empresa[]));

drop policy if exists "parametros_viaticos_delete_admin" on public.parametros_viaticos;
create policy "parametros_viaticos_delete_admin"
  on public.parametros_viaticos for delete
  using (public.tiene_rol_empresa(empresa_id, array['admin']::public.rol_empresa[]));
