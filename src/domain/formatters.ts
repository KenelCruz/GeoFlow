/**
 * Utilidades de formato para República Dominicana (es-DO, RD$) y etiquetas de dominio.
 * Sin dependencias de React.
 */
import type {
  CargoPersonal,
  EstadoTrabajo,
  EstadoVehiculo,
  RolEmpresa,
} from './types';

export const ESTADOS_TRABAJO: EstadoTrabajo[] = [
  'cotizado',
  'aprobado',
  'programado',
  'en_campo',
  'procesando',
  'entregado',
  'cobrado',
];

export const ETIQUETAS_ESTADO_TRABAJO: Record<EstadoTrabajo, string> = {
  cotizado: 'Cotizado',
  aprobado: 'Aprobado',
  programado: 'Programado',
  en_campo: 'En campo',
  procesando: 'Procesando',
  entregado: 'Entregado',
  cobrado: 'Cobrado',
};

export const ETIQUETAS_CARGO: Record<CargoPersonal, string> = {
  tecnico: 'Técnico',
  ingeniero: 'Ingeniero',
  jefe_brigada: 'Jefe de brigada',
  chofer: 'Chofer',
};

export const ETIQUETAS_ESTADO_VEHICULO: Record<EstadoVehiculo, string> = {
  disponible: 'Disponible',
  en_uso: 'En uso',
  mantenimiento: 'Mantenimiento',
};

export const ETIQUETAS_ROL: Record<RolEmpresa, string> = {
  admin: 'Administrador',
  coordinador: 'Coordinador',
  tecnico: 'Técnico',
};

/** Formatea montos en pesos dominicanos (RD$) */
export function formatearMonedaRD(monto: number): string {
  return `RD$ ${new Intl.NumberFormat('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto)}`;
}

/** Formatea una fecha YYYY-MM-DD a formato legible en español dominicano */
export function formatearFechaCorta(fechaISO: string): string {
  if (!fechaISO) return 'Sin fecha';
  const partes = fechaISO.split('-').map(Number);
  if (partes.length !== 3) return fechaISO;
  const fecha = new Date(partes[0], partes[1] - 1, partes[2]);
  return new Intl.DateTimeFormat('es-DO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(fecha);
}

/** Formatea una fecha y hora ISO 8601 a hora local de República Dominicana */
export function formatearFechaHora(iso: string): string {
  if (!iso) return '';
  const fecha = new Date(iso);
  return new Intl.DateTimeFormat('es-DO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(fecha);
}

/** Devuelve la fecha actual en formato YYYY-MM-DD en zona horaria local */
export function obtenerFechaHoyISO(): string {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, '0');
  const d = String(hoy.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
