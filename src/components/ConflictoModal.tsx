/**
 * Modal de confirmación explícita cuando se detectan conflictos de agenda
 * (técnico o vehículo ya asignado a otro trabajo en la misma fecha).
 */
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatearFechaCorta } from '../domain/formatters';
import type { ConflictoAgenda } from '../domain/types';
import { ModalSheet } from './ui/ModalSheet';

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
    <ModalSheet
      open={conflictos.length > 0}
      title="Conflicto de agenda detectado"
      onClose={onCancelar}
      maxWidthClass="sm:max-w-md"
    >
      <div className="flex items-start gap-2.5 text-sm text-slate-600">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <p>
          Los siguientes recursos ya están asignados a otro levantamiento en la
          misma fecha. ¿Deseas guardar la asignación de todas formas?
        </p>
      </div>

      <ul className="mt-4 divide-y divide-amber-200/70 rounded-xl border border-amber-200 bg-amber-50/70">
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
              <span className="font-mono tabular-nums">
                {formatearFechaCorta(c.fecha)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancelar}
          className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirmar}
          className="min-h-[44px] rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
        >
          Confirmar asignación
        </button>
      </div>
    </ModalSheet>
  );
};
