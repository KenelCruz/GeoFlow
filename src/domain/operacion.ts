/**
 * Reglas de negocio puras para permisos por rol, transiciones de estado
 * y decisión de fuente de datos (remoto vs. caché offline).
 * Sin dependencias de React ni de Supabase.
 */
import { ESTADOS_TRABAJO } from './formatters';
import type {
  EstadoTrabajo,
  RolEmpresa,
  Trabajo,
  Vehiculo,
} from './types';

/** Estados operativos que un técnico puede seleccionar en campo */
export const ESTADOS_CAMPO_TECNICO: readonly EstadoTrabajo[] = [
  'programado',
  'en_campo',
  'procesando',
  'entregado',
];

/** Solo administradores y coordinadores pueden crear/editar trabajos, personal, vehículos y asignaciones */
export function puedeGestionarOperacion(rol: RolEmpresa | null): boolean {
  return rol === 'admin' || rol === 'coordinador';
}

/** Solo los administradores pueden eliminar trabajos, personal o vehículos */
export function puedeEliminarRegistros(rol: RolEmpresa | null): boolean {
  return rol === 'admin';
}

/** Todos los miembros autenticados de la empresa pueden cambiar el estado operativo en campo */
export function puedeActualizarEstadoCampo(rol: RolEmpresa | null): boolean {
  return rol === 'admin' || rol === 'coordinador' || rol === 'tecnico';
}

/**
 * Devuelve los estados de trabajo que el rol puede seleccionar en la interfaz.
 * - Si el rol no puede cambiar estado, retorna lista vacía.
 * - Técnicos solo ven estados operativos de campo (excluye cotizado, aprobado y cobrado).
 * - Admin y coordinador ven el listado completo.
 */
export function obtenerEstadosPermitidosPorRol(
  rol: RolEmpresa | null
): EstadoTrabajo[] {
  if (!puedeActualizarEstadoCampo(rol)) {
    return [];
  }
  if (rol === 'tecnico') {
    return [...ESTADOS_CAMPO_TECNICO];
  }
  return [...ESTADOS_TRABAJO];
}

export type FuenteDatosOperacion =
  | 'remoto'
  | 'error_remoto'
  | 'cache_respaldo_aceptado'
  | 'cache_offline'
  | 'sin_datos_offline';

export interface EntradaDecisionFuenteDatos {
  isOnline: boolean;
  huboErrorRemoto: boolean;
  hayCacheDisponible: boolean;
  usuarioAceptoCache?: boolean;
}

export interface DecisionFuenteDatos {
  fuente: FuenteDatosOperacion;
  usarCache: boolean;
  mostrarError: boolean;
  puedeUsarCacheOpcional: boolean;
}

/**
 * Decide si la carga inicial debe usar datos remotos, caché offline o mostrar error.
 * Nunca cae silenciosamente al caché cuando hay conexión y la consulta remota falla,
 * salvo que el usuario haya aceptado explícitamente usar el respaldo local.
 */
export function decidirFuenteDeDatos({
  isOnline,
  huboErrorRemoto,
  hayCacheDisponible,
  usuarioAceptoCache = false,
}: EntradaDecisionFuenteDatos): DecisionFuenteDatos {
  if (isOnline) {
    if (!huboErrorRemoto) {
      return {
        fuente: 'remoto',
        usarCache: false,
        mostrarError: false,
        puedeUsarCacheOpcional: false,
      };
    }

    if (usuarioAceptoCache && hayCacheDisponible) {
      return {
        fuente: 'cache_respaldo_aceptado',
        usarCache: true,
        mostrarError: false,
        puedeUsarCacheOpcional: false,
      };
    }

    return {
      fuente: 'error_remoto',
      usarCache: false,
      mostrarError: true,
      puedeUsarCacheOpcional: hayCacheDisponible,
    };
  }

  if (hayCacheDisponible) {
    return {
      fuente: 'cache_offline',
      usarCache: true,
      mostrarError: false,
      puedeUsarCacheOpcional: false,
    };
  }

  return {
    fuente: 'sin_datos_offline',
    usarCache: false,
    mostrarError: false,
    puedeUsarCacheOpcional: false,
  };
}

/**
 * Calcula los nuevos campos de un trabajo al cambiar su estado operativo.
 */
export function aplicarTransicionEstadoTrabajo(
  trabajo: Trabajo,
  nuevoEstado: EstadoTrabajo,
  ahoraISO: string = new Date().toISOString()
): Trabajo {
  return {
    ...trabajo,
    estado: nuevoEstado,
    fecha_inicio_real:
      nuevoEstado === 'en_campo' && !trabajo.fecha_inicio_real
        ? ahoraISO
        : trabajo.fecha_inicio_real,
    fecha_fin_real:
      nuevoEstado === 'entregado' && !trabajo.fecha_fin_real
        ? ahoraISO
        : trabajo.fecha_fin_real,
  };
}

/**
 * Verifica si un vehículo presenta una advertencia operativa antes de asignarlo.
 */
export function obtenerAdvertenciaVehiculo(vehiculo: Vehiculo): string | null {
  if (vehiculo.estado === 'mantenimiento') {
    return `El vehículo "${vehiculo.nombre}" está actualmente en mantenimiento.`;
  }
  return null;
}
