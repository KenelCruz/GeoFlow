/**
 * Pantalla de selección de empresa cuando el usuario pertenece a una o más empresas.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronRight, LogOut } from 'lucide-react';
import { ETIQUETAS_ROL } from '../domain/formatters';
import { useAuth } from '../hooks/useAuth';

export const SeleccionEmpresaPage: React.FC = () => {
  const { usuario, membresias, seleccionarEmpresa, cerrarSesion } = useAuth();
  const navigate = useNavigate();

  const handleElegir = (empresaId: string) => {
    seleccionarEmpresa(empresaId);
    navigate('/trabajos');
  };

  const handleSalir = async () => {
    await cerrarSesion();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6">
          <p className="text-xs font-medium text-slate-500">
            Sesión iniciada como {usuario?.email}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Selecciona una empresa
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Cada empresa mantiene sus trabajos, personal, vehículos y bitácoras
            aislados.
          </p>
        </div>

        <div className="space-y-3">
          {membresias.map((m) => (
            <button
              key={m.empresa_id}
              type="button"
              onClick={() => handleElegir(m.empresa_id)}
              className="flex min-h-[76px] w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-emerald-500 hover:bg-emerald-50/30"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-slate-900">
                    {m.empresa?.nombre ?? 'Empresa'}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono tabular-nums">
                      RNC {m.empresa?.rnc ?? 'N/D'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Rol: {ETIQUETAS_ROL[m.rol]}</span>
                  </div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
            </button>
          ))}

          {membresias.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
              Tu usuario aún no está asignado a ninguna empresa. Solicita acceso
              al administrador.
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleSalir}
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <LogOut className="h-4 w-4" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </div>
  );
};
