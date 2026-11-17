/**
 * Shell principal adaptable:
 * - Escritorio (md+): barra lateral fija + barra superior contextual.
 * - Móvil (<md): cabecera compacta y barra inferior fija en la zona del pulgar.
 */
import React from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Briefcase,
  Building2,
  CalendarDays,
  Compass,
  Layers,
  LogOut,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { ETIQUETAS_ROL } from '../domain/formatters';
import { useAuth } from '../hooks/useAuth';
import { useOperacionData } from '../hooks/useOperacionData';
import { OfflineIndicator } from './OfflineIndicator';
import { PWAInstallButton } from './PWAInstallButton';

const NAV_ITEMS = [
  { to: '/trabajos', label: 'Trabajos', icon: Briefcase },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/personal', label: 'Personal', icon: Users },
  { to: '/vehiculos', label: 'Vehículos', icon: Truck },
  { to: '/visor-geo', label: 'Cotizar KMZ', icon: Layers },
];

function obtenerNombreSeccion(pathname: string): string {
  if (pathname.includes('/bitacora')) return 'Operación / Trabajos / Bitácora';
  if (pathname.startsWith('/trabajos/')) return 'Operación / Trabajos / Detalle';
  if (pathname.startsWith('/trabajos')) return 'Operación / Trabajos';
  if (pathname.startsWith('/agenda')) return 'Operación / Agenda';
  if (pathname.startsWith('/personal')) return 'Operación / Personal';
  if (pathname.startsWith('/vehiculos')) return 'Operación / Vehículos';
  if (pathname.startsWith('/visor-geo')) return 'Cotización y Geoespacial / Cotizar KMZ';
  return 'Operación';
}

export const Layout: React.FC = () => {
  const { empresaActiva, rolActivo, membresias, cerrarSesion } = useAuth();
  const {
    errorOperacion,
    cacheRespaldoDisponible,
    aceptarCacheRespaldo,
    limpiarErrorOperacion,
  } = useOperacionData();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSalir = async () => {
    await cerrarSesion();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 md:flex md:pb-0">
      {/* Barra lateral fija en escritorio */}
      <aside
        aria-label="Navegación lateral"
        className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-60 lg:w-64 md:shrink-0 md:flex-col md:border-r md:border-slate-200 md:bg-white"
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-slate-200 px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-emerald-400">
            <Compass className="h-4 w-4" />
          </div>
          <Link
            to="/trabajos"
            className="truncate text-sm font-bold tracking-tight text-slate-900"
          >
            Cotizador de Levantamientos
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex min-h-[44px] items-center gap-3 rounded-xl px-3.5 text-sm transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-50 font-semibold text-emerald-900'
                      : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-slate-200 p-4">
          {empresaActiva && (
            <div className="space-y-0.5 px-1">
              <p className="truncate text-xs font-semibold text-slate-900">
                {empresaActiva.nombre}
              </p>
              <p className="text-[11px] text-slate-500">
                <span className="font-mono tabular-nums">
                  RNC {empresaActiva.rnc}
                </span>
                {rolActivo ? ` · ${ETIQUETAS_ROL[rolActivo]}` : ''}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <PWAInstallButton />

            {membresias.length > 1 && (
              <button
                type="button"
                onClick={() => navigate('/seleccionar-empresa')}
                className="inline-flex min-h-[40px] w-full items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
              >
                <Building2 className="h-4 w-4 shrink-0 text-slate-500" />
                <span>Cambiar empresa</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSalir}
              className="inline-flex min-h-[40px] w-full items-center gap-2 rounded-xl px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap"
            >
              <LogOut className="h-4 w-4 shrink-0 text-slate-500" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Columna principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Cabecera contextual en escritorio */}
        <header className="hidden md:sticky md:top-0 md:z-20 md:flex md:h-14 md:items-center md:justify-between md:border-b md:border-slate-200 md:bg-white/95 md:px-6 md:backdrop-blur-md">
          <p className="text-xs font-medium text-slate-500">
            {obtenerNombreSeccion(location.pathname)}
          </p>
          {empresaActiva && (
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-900">
                {empresaActiva.nombre}
              </span>
              {rolActivo && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{ETIQUETAS_ROL[rolActivo]}</span>
                </>
              )}
            </div>
          )}
        </header>

        {/* Cabecera compacta en móvil */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md md:hidden">
          <div className="flex h-14 items-center justify-between gap-4 px-4">
            <Link
              to="/trabajos"
              className="truncate text-sm font-bold tracking-tight text-slate-900"
            >
              Cotizador de Levantamientos
            </Link>

            <div className="flex items-center gap-1.5 shrink-0">
              <PWAInstallButton />
              {membresias.length > 1 && (
                <button
                  type="button"
                  onClick={() => navigate('/seleccionar-empresa')}
                  className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                  aria-label="Cambiar de empresa"
                  title="Cambiar de empresa"
                >
                  <Building2 className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={handleSalir}
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <OfflineIndicator />

        {errorOperacion && (
          <div
            role="alert"
            className="border-b border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-900"
          >
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-700" />
                <span>{errorOperacion}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {cacheRespaldoDisponible && (
                  <button
                    type="button"
                    onClick={() => void aceptarCacheRespaldo()}
                    className="rounded-lg border border-red-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 whitespace-nowrap"
                  >
                    Usar último respaldo local
                  </button>
                )}
                <button
                  type="button"
                  onClick={limpiarErrorOperacion}
                  className="flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg text-red-700 hover:bg-red-100"
                  aria-label="Cerrar aviso"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Contexto de empresa activa en móvil */}
        {empresaActiva && (
          <div className="border-b border-slate-200/70 bg-slate-100/70 px-4 py-1.5 md:hidden">
            <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2 truncate">
                <span className="truncate font-semibold text-slate-800">
                  {empresaActiva.nombre}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  RNC {empresaActiva.rnc}
                </span>
              </div>
              {rolActivo && (
                <span className="shrink-0 text-slate-500">
                  {ETIQUETAS_ROL[rolActivo]}
                </span>
              )}
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>

      {/* Navegación inferior fija en móvil (zona natural del pulgar) */}
      <nav
        aria-label="Navegación principal"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md pb-safe md:hidden"
      >
        <div className="grid h-16 grid-cols-5 items-center">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex min-h-[48px] flex-col items-center justify-center gap-1 text-[10px] transition-colors ${
                    isActive
                      ? 'font-semibold text-emerald-700'
                      : 'font-medium text-slate-500 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                <span className="truncate max-w-full px-1">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
