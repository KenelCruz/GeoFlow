/**
 * Lógica de negocio pura para detección de conflictos de agenda y programación.
 * Sin dependencias de React ni de infraestructura.
 */
import type {
  ConflictoAgenda,
  Personal,
  Trabajo,
  TrabajoPersonal,
  TrabajoVehiculo,
  Vehiculo,
} from './types';

export interface EntradaVerificacionPersonal {
  trabajoIdActual: string;
  personalId: string;
  fecha: string;
  asignacionesExistentes: TrabajoPersonal[];
  trabajos: Trabajo[];
  personal: Personal[];
}

export interface EntradaVerificacionVehiculo {
  trabajoIdActual: string;
  vehiculoId: string;
  fecha: string;
  asignacionesExistentes: TrabajoVehiculo[];
  trabajos: Trabajo[];
  vehiculos: Vehiculo[];
}

/**
 * Detecta si un técnico/personal ya está asignado a otro trabajo en la misma fecha.
 */
export function detectarConflictosPersonal(
  entrada: EntradaVerificacionPersonal
): ConflictoAgenda[] {
  const {
    trabajoIdActual,
    personalId,
    fecha,
    asignacionesExistentes,
    trabajos,
    personal,
  } = entrada;

  const persona = personal.find((p) => p.id === personalId);
  const nombrePersona = persona?.nombre ?? 'Técnico sin nombre';

  return asignacionesExistentes
    .filter(
      (asig) =>
        asig.personal_id === personalId &&
        asig.fecha === fecha &&
        asig.trabajo_id !== trabajoIdActual
    )
    .map((asig) => {
      const trabajoConflicto = trabajos.find((t) => t.id === asig.trabajo_id);
      return {
        tipo: 'personal' as const,
        recurso_id: personalId,
        recurso_nombre: nombrePersona,
        fecha,
        trabajo_conflicto_id: asig.trabajo_id,
        trabajo_conflicto_cliente:
          trabajoConflicto?.cliente ?? 'Trabajo programado',
      };
    });
}

/**
 * Detecta si un vehículo ya está asignado a otro trabajo en la misma fecha.
 */
export function detectarConflictosVehiculo(
  entrada: EntradaVerificacionVehiculo
): ConflictoAgenda[] {
  const {
    trabajoIdActual,
    vehiculoId,
    fecha,
    asignacionesExistentes,
    trabajos,
    vehiculos,
  } = entrada;

  const vehiculo = vehiculos.find((v) => v.id === vehiculoId);
  const nombreVehiculo = vehiculo?.nombre ?? 'Vehículo sin nombre';

  return asignacionesExistentes
    .filter(
      (asig) =>
        asig.vehiculo_id === vehiculoId &&
        asig.fecha === fecha &&
        asig.trabajo_id !== trabajoIdActual
    )
    .map((asig) => {
      const trabajoConflicto = trabajos.find((t) => t.id === asig.trabajo_id);
      return {
        tipo: 'vehiculo' as const,
        recurso_id: vehiculoId,
        recurso_nombre: nombreVehiculo,
        fecha,
        trabajo_conflicto_id: asig.trabajo_id,
        trabajo_conflicto_cliente:
          trabajoConflicto?.cliente ?? 'Trabajo programado',
      };
    });
}

/**
 * Verifica en lote los conflictos de múltiples técnicos y vehículos para una fecha y trabajo dados.
 */
export function detectarTodosLosConflictos(params: {
  trabajoIdActual: string;
  fecha: string;
  personalIds: string[];
  vehiculoIds: string[];
  asignacionesPersonal: TrabajoPersonal[];
  asignacionesVehiculo: TrabajoVehiculo[];
  trabajos: Trabajo[];
  personal: Personal[];
  vehiculos: Vehiculo[];
}): ConflictoAgenda[] {
  const conflictosPersonal = params.personalIds.flatMap((personalId) =>
    detectarConflictosPersonal({
      trabajoIdActual: params.trabajoIdActual,
      personalId,
      fecha: params.fecha,
      asignacionesExistentes: params.asignacionesPersonal,
      trabajos: params.trabajos,
      personal: params.personal,
    })
  );

  const conflictosVehiculo = params.vehiculoIds.flatMap((vehiculoId) =>
    detectarConflictosVehiculo({
      trabajoIdActual: params.trabajoIdActual,
      vehiculoId,
      fecha: params.fecha,
      asignacionesExistentes: params.asignacionesVehiculo,
      trabajos: params.trabajos,
      vehiculos: params.vehiculos,
    })
  );

  return [...conflictosPersonal, ...conflictosVehiculo];
}

/**
 * Genera las 7 fechas (lunes a domingo) de la semana que contiene `fechaReferencia` (YYYY-MM-DD).
 */
export function obtenerFechasSemana(fechaReferencia: string): string[] {
  const [y, m, d] = fechaReferencia.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  // getDay(): 0 = domingo, 1 = lunes ... 6 = sábado
  const diaSemana = fecha.getDay();
  const ajusteLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
  const lunes = new Date(y, m - 1, d + ajusteLunes);

  const dias: string[] = [];
  for (let i = 0; i < 7; i++) {
    const actual = new Date(
      lunes.getFullYear(),
      lunes.getMonth(),
      lunes.getDate() + i
    );
    const ay = actual.getFullYear();
    const am = String(actual.getMonth() + 1).padStart(2, '0');
    const ad = String(actual.getDate()).padStart(2, '0');
    dias.push(`${ay}-${am}-${ad}`);
  }
  return dias;
}

export interface ResumenAgendaDia {
  fecha: string;
  trabajos: Array<{
    trabajo: Trabajo;
    personalAsignado: Personal[];
    vehiculosAsignados: Vehiculo[];
  }>;
}

/**
 * Construye la agenda detallada para una fecha específica, combinando
 * trabajos cuya fecha_prevista coincide o que tienen personal/vehículos asignados ese día.
 */
export function obtenerAgendaPorFecha(params: {
  fecha: string;
  trabajos: Trabajo[];
  personal: Personal[];
  vehiculos: Vehiculo[];
  asignacionesPersonal: TrabajoPersonal[];
  asignacionesVehiculo: TrabajoVehiculo[];
}): ResumenAgendaDia {
  const {
    fecha,
    trabajos,
    personal,
    vehiculos,
    asignacionesPersonal,
    asignacionesVehiculo,
  } = params;

  const asigPersDia = asignacionesPersonal.filter((a) => a.fecha === fecha);
  const asigVehDia = asignacionesVehiculo.filter((a) => a.fecha === fecha);

  const idsTrabajosDia = new Set<string>();
  trabajos
    .filter((t) => t.fecha_prevista === fecha)
    .forEach((t) => idsTrabajosDia.add(t.id));
  asigPersDia.forEach((a) => idsTrabajosDia.add(a.trabajo_id));
  asigVehDia.forEach((a) => idsTrabajosDia.add(a.trabajo_id));

  const trabajosDia = trabajos
    .filter((t) => idsTrabajosDia.has(t.id))
    .map((trabajo) => {
      const idsPersonal = asigPersDia
        .filter((a) => a.trabajo_id === trabajo.id)
        .map((a) => a.personal_id);
      const idsVehiculos = asigVehDia
        .filter((a) => a.trabajo_id === trabajo.id)
        .map((a) => a.vehiculo_id);

      return {
        trabajo,
        personalAsignado: personal.filter((p) => idsPersonal.includes(p.id)),
        vehiculosAsignados: vehiculos.filter((v) => idsVehiculos.includes(v.id)),
      };
    });

  return {
    fecha,
    trabajos: trabajosDia,
  };
}
