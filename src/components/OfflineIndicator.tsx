/**
 * Indicador de estado sin conexión, cola de sincronización y errores de sincronización pendientes.
 */
import React from 'react';
import { AlertCircle, CloudOff, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useOperacionData } from '../hooks/useOperacionData';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const {
    pendientesSincronizar,
    sincronizando,
    ultimoErrorSincronizacion,
    sincronizarColaAhora,
  } = useOperacionData();

  if (isOnline && pendientesSincronizar === 0 && !ultimoErrorSincronizacion) {
    return null;
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-medium">
          {!isOnline ? (
            <CloudOff className="h-4 w-4 shrink-0 text-amber-700" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-700" />
          )}
          {!isOnline ? (
            <span>
              Sin conexión. Las notas y fotos de bitácora se guardan en el
              dispositivo y se sincronizarán al volver la señal.
            </span>
          ) : ultimoErrorSincronizacion ? (
            <span>
              {pendientesSincronizar} registro(s) pendiente(s). Error al
              sincronizar: {ultimoErrorSincronizacion}
            </span>
          ) : (
            <span>
              {pendientesSincronizar} registro(s) de bitácora pendientes de
              sincronizar.
            </span>
          )}
        </div>
        {isOnline && pendientesSincronizar > 0 && (
          <button
            type="button"
            onClick={sincronizarColaAhora}
            disabled={sincronizando}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${sincronizando ? 'animate-spin' : ''}`}
            />
            <span>{sincronizando ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
