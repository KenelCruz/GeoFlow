/**
 * Shell principal móvil-primero con barra superior limpia (contrato de 3 zonas),
 * banner de errores operativos y navegación inferior ergonómica para uso con una mano.
 */
import React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Briefcase,
  Building2,
  CalendarDays,
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
];

export const Layout: React.FC = () => {
  const { empresaActiva, rolActivo, membresias, cerrarSesion } = useAuth();
  const { errorOperacion, limpiarErrorOperacion } = useOperacionData();
  const navigate = useNavigate();

  const handleSalir = async () => {
    await cerrarSesion();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 md:pb-8">
      {/* Barra superior compacta (3 zonas: Marca — Enlaces — Acción) */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-8 px-4">
          <Link
            to="/trabajos"
            className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            Cotizador de Levantamientos
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `py-1 transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-slate-950 font-semibold border-b-2 border-emerald-600'
                      : 'hover:text-slate-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton />
            {membresias.length > 1 && (
              <button
                type="button"
                onClick={() => navigate('/seleccionar-empresa')}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                title="Cambiar de empresa"
              >
                <Building2 className="h-4 w-4 text-slate-500" />
                <span className="hidden sm:inline max-w-[140px] truncate">
                  {empresaActiva?.nombre}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={handleSalir}
              className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
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
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-700" />
              <span>{errorOperacion}</span>
            </div>
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
      )}

      {/* Contexto silencioso de empresa activa */}
      {empresaActiva && (
        <div className="border-b border-slate-200/70 bg-slate-100/70 px-4 py-2">
          <div className="mx-auto flex max-w-6xl items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-2 truncate">
              <span className="font-semibold text-slate-800 truncate">
                {empresaActiva.nombre}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                RNC {empresaActiva.rnc}
              </span>
            </div>
            {rolActivo && (
              <span className="shrink-0 text-slate-500">
                Rol: {ETIQUETAS_ROL[rolActivo]}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Contenido principal */}
      <main className="mx-auto max-w-6xl px-4 py-5 sm:py-6">
        <Outlet />
      </main>

      {/* Navegación inferior fija en móvil (zona natural del pulgar) */}
      <nav
        aria-label="Navegación principal"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md md:hidden"
      >
        <div className="grid h-16 grid-cols-4 items-center">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex min-h-[48px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                    isActive
                      ? 'text-emerald-700 font-semibold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
