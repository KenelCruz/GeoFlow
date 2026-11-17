import { describe, expect, it } from 'vitest';
import {
  detectarConflictosPersonal,
  detectarConflictosVehiculo,
  detectarTodosLosConflictos,
  obtenerAgendaPorFecha,
  obtenerFechasSemana,
} from './conflictos';
import type {
  Personal,
  Trabajo,
  TrabajoPersonal,
  TrabajoVehiculo,
  Vehiculo,
} from './types';

// Datos ficticios para pruebas unitarias
const personalPrueba: Personal[] = [
  {
    id: 'p-1',
    empresa_id: 'emp-1',
    nombre: 'Carlos Méndez (Ficticio)',
    cargo: 'jefe_brigada',
    telefono: '809-555-0101',
    activo: true,
  },
  {
    id: 'p-2',
    empresa_id: 'emp-1',
    nombre: 'Ana Báez (Ficticio)',
    cargo: 'tecnico',
    telefono: '809-555-0102',
    activo: true,
  },
];

const vehiculosPrueba: Vehiculo[] = [
  {
    id: 'v-1',
    empresa_id: 'emp-1',
    nombre: 'Hilux Blanca #01',
    tipo: 'Camioneta 4x4',
    combustible: 'Gasoil',
    rendimiento_km_gal: 32,
    estado: 'disponible',
  },
];

const trabajosPrueba: Trabajo[] = [
  {
    id: 't-1',
    empresa_id: 'emp-1',
    cliente: 'Constructora Norte Ficticia',
    contacto: '809-555-1000',
    ubicacion_texto: 'Santiago de los Caballeros',
    lat: null,
    lng: null,
    tipo_levantamiento: 'Deslinde',
    fecha_prevista: '2026-11-18',
    fecha_inicio_real: null,
    fecha_fin_real: null,
    estado: 'programado',
    responsable_id: 'p-1',
  },
  {
    id: 't-2',
    empresa_id: 'emp-1',
    cliente: 'Inmobiliaria Sur Demo',
    contacto: '809-555-2000',
    ubicacion_texto: 'San Cristóbal',
    lat: null,
    lng: null,
    tipo_levantamiento: 'Topográfico',
    fecha_prevista: '2026-11-18',
    fecha_inicio_real: null,
    fecha_fin_real: null,
    estado: 'aprobado',
    responsable_id: 'p-2',
  },
];

const asignacionesPersonal: TrabajoPersonal[] = [
  {
    id: 'ap-1',
    empresa_id: 'emp-1',
    trabajo_id: 't-1',
    personal_id: 'p-1',
    fecha: '2026-11-18',
  },
];

const asignacionesVehiculo: TrabajoVehiculo[] = [
  {
    id: 'av-1',
    empresa_id: 'emp-1',
    trabajo_id: 't-1',
    vehiculo_id: 'v-1',
    fecha: '2026-11-18',
  },
];

describe('Detección de conflictos de agenda', () => {
  it('detecta conflicto cuando un técnico ya está asignado a otro trabajo el mismo día', () => {
    const conflictos = detectarConflictosPersonal({
      trabajoIdActual: 't-2',
      personalId: 'p-1',
      fecha: '2026-11-18',
      asignacionesExistentes: asignacionesPersonal,
      trabajos: trabajosPrueba,
      personal: personalPrueba,
    });

    expect(conflictos).toHaveLength(1);
    expect(conflictos[0]).toMatchObject({
      tipo: 'personal',
      recurso_id: 'p-1',
      recurso_nombre: 'Carlos Méndez (Ficticio)',
      trabajo_conflicto_id: 't-1',
      trabajo_conflicto_cliente: 'Constructora Norte Ficticia',
    });
  });

  it('no marca conflicto si el técnico ya está asignado al mismo trabajo', () => {
    const conflictos = detectarConflictosPersonal({
      trabajoIdActual: 't-1',
      personalId: 'p-1',
      fecha: '2026-11-18',
      asignacionesExistentes: asignacionesPersonal,
      trabajos: trabajosPrueba,
      personal: personalPrueba,
    });

    expect(conflictos).toHaveLength(0);
  });

  it('no marca conflicto si la asignación es en una fecha diferente', () => {
    const conflictos = detectarConflictosPersonal({
      trabajoIdActual: 't-2',
      personalId: 'p-1',
      fecha: '2026-11-19',
      asignacionesExistentes: asignacionesPersonal,
      trabajos: trabajosPrueba,
      personal: personalPrueba,
    });

    expect(conflictos).toHaveLength(0);
  });

  it('detecta conflicto cuando un vehículo ya está asignado a otro trabajo el mismo día', () => {
    const conflictos = detectarConflictosVehiculo({
      trabajoIdActual: 't-2',
      vehiculoId: 'v-1',
      fecha: '2026-11-18',
      asignacionesExistentes: asignacionesVehiculo,
      trabajos: trabajosPrueba,
      vehiculos: vehiculosPrueba,
    });

    expect(conflictos).toHaveLength(1);
    expect(conflictos[0].tipo).toBe('vehiculo');
    expect(conflictos[0].recurso_nombre).toBe('Hilux Blanca #01');
  });

  it('detecta conflictos combinados de personal y vehículos en lote', () => {
    const conflictos = detectarTodosLosConflictos({
      trabajoIdActual: 't-2',
      fecha: '2026-11-18',
      personalIds: ['p-1', 'p-2'],
      vehiculoIds: ['v-1'],
      asignacionesPersonal,
      asignacionesVehiculo,
      trabajos: trabajosPrueba,
      personal: personalPrueba,
      vehiculos: vehiculosPrueba,
    });

    expect(conflictos).toHaveLength(2);
    expect(conflictos.map((c) => c.tipo).sort()).toEqual([
      'personal',
      'vehiculo',
    ]);
  });

  it('calcula correctamente los 7 días de la semana de lunes a domingo', () => {
    // 2026-11-18 es miércoles
    const semana = obtenerFechasSemana('2026-11-18');
    expect(semana).toHaveLength(7);
    expect(semana[0]).toBe('2026-11-16'); // Lunes
    expect(semana[6]).toBe('2026-11-22'); // Domingo
  });

  it('agrupa trabajos, personal y vehículos en la agenda por fecha', () => {
    const agenda = obtenerAgendaPorFecha({
      fecha: '2026-11-18',
      trabajos: trabajosPrueba,
      personal: personalPrueba,
      vehiculos: vehiculosPrueba,
      asignacionesPersonal,
      asignacionesVehiculo,
    });

    expect(agenda.trabajos).toHaveLength(2);
    const t1 = agenda.trabajos.find((item) => item.trabajo.id === 't-1');
    expect(t1?.personalAsignado).toHaveLength(1);
    expect(t1?.vehiculosAsignados).toHaveLength(1);
  });
});
