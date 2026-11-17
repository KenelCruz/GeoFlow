/**
 * Botón de instalación de PWA para Android/Escritorio e instrucciones para iPhone/iPad (Safari).
 */
import React, { useState } from 'react';
import { Download, Share } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { ModalSheet } from './ui/ModalSheet';

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
        className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 whitespace-nowrap shrink-0"
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
          className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          <Share className="h-4 w-4" />
          <span>Instalar en iPhone</span>
        </button>

        <ModalSheet
          open={mostrarGuiaIOS}
          title="Instalar en iPhone o iPad"
          onClose={() => setMostrarGuiaIOS(false)}
          maxWidthClass="sm:max-w-sm"
        >
          <ol className="space-y-3 text-sm text-slate-600">
            <li>
              1. Toca el botón <strong>Compartir</strong> en la barra inferior
              de Safari.
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
            className="mt-5 min-h-[44px] w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Entendido
          </button>
        </ModalSheet>
      </>
    );
  }

  return null;
};
