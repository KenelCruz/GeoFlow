/**
 * Modal de confirmación explícita cuando se detectan conflictos de agenda
 * (técnico o vehículo ya asignado a otro trabajo en la misma fecha).
 */
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { formatearFechaCorta } from '../domain/formatters';
import type { ConflictoAgenda } from '../domain/types';

interface ConflictoModalProps {
  conflictos: ConflictoAgenda[];
  onCancelar: () => void;
  onConfirmar: () => void;
}

export const ConflictoModal: React.FC<ConflictoModalProps> = ({
  conflictos,
  onCancelar,
  onConfirmar,
}) => {
  if (conflictos.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-conflicto"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 text-amber-700">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <h3
              id="titulo-conflicto"
              className="text-base font-bold text-slate-900"
            >
              Conflicto de agenda detectado
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancelar}
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-sm text-slate-600">
          Los siguientes recursos ya están asignados a otro levantamiento en la
          misma fecha. ¿Deseas guardar la asignación de todas formas?
        </p>

        <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-amber-200 bg-amber-50/70">
          {conflictos.map((c, idx) => (
            <li key={`${c.recurso_id}-${idx}`} className="p-3 text-sm">
              <div className="font-semibold text-slate-900">
                {c.recurso_nombre}{' '}
                <span className="font-normal text-slate-500">
                  ({c.tipo === 'personal' ? 'Personal' : 'Vehículo'})
                </span>
              </div>
              <div className="mt-0.5 text-xs text-slate-600">
                Ya asignado a <strong>{c.trabajo_conflicto_cliente}</strong> ·{' '}
                {formatearFechaCorta(c.fecha)}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancelar}
            className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            className="min-h-[44px] rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Confirmar asignación
          </button>
        </div>
      </div>
    </div>
  );
};
