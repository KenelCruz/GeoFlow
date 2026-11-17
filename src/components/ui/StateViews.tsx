/**
 * Vistas reutilizables de estado vacío y carga (esqueleto) con geometría alineada a las listas.
 */
import React from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
}) => {
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
};

interface ListSkeletonProps {
  rows?: number;
}

export const ListSkeleton: React.FC<ListSkeletonProps> = ({ rows = 4 }) => {
  return (
    <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="flex items-center justify-between gap-4 p-4">
          <div className="w-full space-y-2">
            <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-64 max-w-full animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
};
