/**
 * Botón de instalación de PWA para Android/Escritorio e instrucciones para iPhone/iPad (Safari).
 */
import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [mostrarGuiaIOS, setMostrarGuiaIOS] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 whitespace-nowrap shrink-0"
      >
        <Download className="h-4 w-4" />
        <span>Instalar app</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setMostrarGuiaIOS(true)}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          <Share className="h-4 w-4" />
          <span>Instalar en iPhone</span>
        </button>

        {mostrarGuiaIOS && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 sm:items-center">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">
                  Instalar en iPhone o iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setMostrarGuiaIOS(false)}
                  className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <ol className="mt-4 space-y-3 text-sm text-slate-600">
                <li>
                  1. Toca el botón <strong>Compartir</strong> en la barra
                  inferior de Safari.
                </li>
                <li>
                  2. Desliza hacia abajo y selecciona{' '}
                  <strong>Agregar a pantalla de inicio</strong>.
                </li>
                <li>
                  3. Toca <strong>Agregar</strong> para usarla sin conexión en
                  campo.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setMostrarGuiaIOS(false)}
                className="mt-5 w-full min-h-[44px] rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
