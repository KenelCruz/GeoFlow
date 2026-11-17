import { describe, expect, it } from 'vitest';
import {
  aplicarTransicionEstadoTrabajo,
  decidirFuenteDeDatos,
  ESTADOS_CAMPO_TECNICO,
  obtenerAdvertenciaVehiculo,
  obtenerEstadosPermitidosPorRol,
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

  it('limita al técnico a los estados operativos de campo y excluye estados comerciales/cobro', () => {
    const estadosTecnico = obtenerEstadosPermitidosPorRol('tecnico');
    expect(estadosTecnico).toEqual([...ESTADOS_CAMPO_TECNICO]);
    expect(estadosTecnico).not.toContain('cotizado');
    expect(estadosTecnico).not.toContain('aprobado');
    expect(estadosTecnico).not.toContain('cobrado');

    expect(obtenerEstadosPermitidosPorRol('admin')).toHaveLength(7);
    expect(obtenerEstadosPermitidosPorRol('coordinador')).toHaveLength(7);
    expect(obtenerEstadosPermitidosPorRol(null)).toEqual([]);
  });
});

describe('Decisión de fuente de datos (remoto vs. caché offline)', () => {
  it('usa datos remotos cuando está en línea y la consulta tiene éxito', () => {
    expect(
      decidirFuenteDeDatos({
        isOnline: true,
        huboErrorRemoto: false,
        hayCacheDisponible: true,
      })
    ).toEqual({
      fuente: 'remoto',
      usarCache: false,
      mostrarError: false,
      puedeUsarCacheOpcional: false,
    });
  });

  it('muestra error y no cae silenciosamente al caché cuando está en línea y falla', () => {
    expect(
      decidirFuenteDeDatos({
        isOnline: true,
        huboErrorRemoto: true,
        hayCacheDisponible: true,
      })
    ).toEqual({
      fuente: 'error_remoto',
      usarCache: false,
      mostrarError: true,
      puedeUsarCacheOpcional: true,
    });

    expect(
      decidirFuenteDeDatos({
        isOnline: true,
        huboErrorRemoto: true,
        hayCacheDisponible: false,
      })
    ).toEqual({
      fuente: 'error_remoto',
      usarCache: false,
      mostrarError: true,
      puedeUsarCacheOpcional: false,
    });
  });

  it('usa el caché en línea únicamente cuando el usuario lo acepta explícitamente', () => {
    expect(
      decidirFuenteDeDatos({
        isOnline: true,
        huboErrorRemoto: true,
        hayCacheDisponible: true,
        usuarioAceptoCache: true,
      })
    ).toEqual({
      fuente: 'cache_respaldo_aceptado',
      usarCache: true,
      mostrarError: false,
      puedeUsarCacheOpcional: false,
    });
  });

  it('usa el caché local cuando no hay conexión y existe snapshot guardado', () => {
    expect(
      decidirFuenteDeDatos({
        isOnline: false,
        huboErrorRemoto: false,
        hayCacheDisponible: true,
      })
    ).toEqual({
      fuente: 'cache_offline',
      usarCache: true,
      mostrarError: false,
      puedeUsarCacheOpcional: false,
    });
  });

  it('informa ausencia de datos sin error remoto cuando no hay conexión ni caché', () => {
    expect(
      decidirFuenteDeDatos({
        isOnline: false,
        huboErrorRemoto: false,
        hayCacheDisponible: false,
      })
    ).toEqual({
      fuente: 'sin_datos_offline',
      usarCache: false,
      mostrarError: false,
      puedeUsarCacheOpcional: false,
    });
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
