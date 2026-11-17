/**
 * Reglas de negocio puras para permisos por rol y transiciones de estado de trabajos.
 * Sin dependencias de React ni de Supabase.
 */
import type {
  EstadoTrabajo,
  RolEmpresa,
  Trabajo,
  Vehiculo,
} from './types';

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
