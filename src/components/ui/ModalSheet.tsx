/**
 * Contenedor modal móvil-primero: hoja inferior (bottom sheet) con indicador táctil en móvil
 * y diálogo centrado con bordes limpios en escritorio.
 */
import React from 'react';
import { X } from 'lucide-react';

interface ModalSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export const ModalSheet: React.FC<ModalSheetProps> = ({
  open,
  title,
  onClose,
  maxWidthClass = 'sm:max-w-lg',
  children,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-[2px] p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white px-5 pb-6 pt-3 shadow-xl sm:rounded-2xl sm:p-6 ${maxWidthClass}`}
      >
        <div
          className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 sm:hidden"
          aria-hidden="true"
        />
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
};
