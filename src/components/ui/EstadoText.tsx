/**
 * Utilitario visual de estado semántico sin cápsulas ni píldoras (texto limpio + color accesible).
 */
import React from 'react';
import { ETIQUETAS_ESTADO_TRABAJO, ETIQUETAS_ESTADO_VEHICULO } from '../../domain/formatters';
import type { EstadoTrabajo, EstadoVehiculo } from '../../domain/types';

const COLOR_ESTADO_TRABAJO: Record<EstadoTrabajo, string> = {
  cotizado: 'text-slate-600',
  aprobado: 'text-sky-700',
  programado: 'text-slate-800',
  en_campo: 'text-emerald-700',
  procesando: 'text-amber-700',
  entregado: 'text-emerald-800',
  cobrado: 'text-slate-700',
};

const COLOR_ESTADO_VEHICULO: Record<EstadoVehiculo, string> = {
  disponible: 'text-emerald-700',
  en_uso: 'text-slate-800',
  mantenimiento: 'text-amber-700',
};

export const EstadoTrabajoTexto: React.FC<{ estado: EstadoTrabajo }> = ({
  estado,
}) => (
  <span className={`font-semibold ${COLOR_ESTADO_TRABAJO[estado]}`}>
    {ETIQUETAS_ESTADO_TRABAJO[estado]}
  </span>
);

export const EstadoVehiculoTexto: React.FC<{ estado: EstadoVehiculo }> = ({
  estado,
}) => (
  <span className={`font-semibold ${COLOR_ESTADO_VEHICULO[estado]}`}>
    {ETIQUETAS_ESTADO_VEHICULO[estado]}
  </span>
);
