import { describe, expect, it } from 'vitest';
import {
  aplicarTransicionEstadoTrabajo,
  obtenerAdvertenciaVehiculo,
  puedeActualizarEstadoCampo,
  puedeEliminarRegistros,
  puedeGestionarOperacion,
} from './operacion';
import type { Trabajo, Vehiculo } from './types';

const trabajoBase: Trabajo = {
  id: 'trb-1',
  empresa_id: 'emp-1',
  cliente: 'Cliente Prueba',
  contacto: '809-555-0000',
  ubicacion_texto: 'Santiago',
  lat: null,
  lng: null,
  tipo_levantamiento: 'Deslinde',
  fecha_prevista: '2026-11-18',
  fecha_inicio_real: null,
  fecha_fin_real: null,
  estado: 'programado',
  responsable_id: null,
};

describe('Permisos por rol en operación', () => {
  it('restringe creación y edición a admin y coordinador', () => {
    expect(puedeGestionarOperacion('admin')).toBe(true);
    expect(puedeGestionarOperacion('coordinador')).toBe(true);
    expect(puedeGestionarOperacion('tecnico')).toBe(false);
    expect(puedeGestionarOperacion(null)).toBe(false);
  });

  it('restringe eliminación únicamente al rol admin', () => {
    expect(puedeEliminarRegistros('admin')).toBe(true);
    expect(puedeEliminarRegistros('coordinador')).toBe(false);
    expect(puedeEliminarRegistros('tecnico')).toBe(false);
  });

  it('permite actualizar estado en campo a todos los roles de la empresa', () => {
    expect(puedeActualizarEstadoCampo('admin')).toBe(true);
    expect(puedeActualizarEstadoCampo('coordinador')).toBe(true);
    expect(puedeActualizarEstadoCampo('tecnico')).toBe(true);
    expect(puedeActualizarEstadoCampo(null)).toBe(false);
  });
});

describe('Transiciones de estado de trabajo', () => {
  it('asigna fecha_inicio_real automáticamente al pasar a en_campo', () => {
    const actualizado = aplicarTransicionEstadoTrabajo(
      trabajoBase,
      'en_campo',
      '2026-11-18T13:00:00.000Z'
    );
    expect(actualizado.estado).toBe('en_campo');
    expect(actualizado.fecha_inicio_real).toBe('2026-11-18T13:00:00.000Z');
    expect(actualizado.fecha_fin_real).toBeNull();
  });

  it('asigna fecha_fin_real al pasar a entregado sin sobrescribir fecha_inicio_real', () => {
    const enCampo: Trabajo = {
      ...trabajoBase,
      estado: 'en_campo',
      fecha_inicio_real: '2026-11-18T09:00:00.000Z',
    };
    const entregado = aplicarTransicionEstadoTrabajo(
      enCampo,
      'entregado',
      '2026-11-18T17:30:00.000Z'
    );
    expect(entregado.fecha_inicio_real).toBe('2026-11-18T09:00:00.000Z');
    expect(entregado.fecha_fin_real).toBe('2026-11-18T17:30:00.000Z');
  });

  it('advierte si se intenta asignar un vehículo en mantenimiento', () => {
    const vehiculo: Vehiculo = {
      id: 'v-1',
      empresa_id: 'emp-1',
      nombre: 'Jimny #03',
      tipo: 'Todo terreno',
      combustible: 'Gasolina',
      rendimiento_km_gal: 38,
      estado: 'mantenimiento',
    };
    expect(obtenerAdvertenciaVehiculo(vehiculo)).toContain('mantenimiento');
  });
});
