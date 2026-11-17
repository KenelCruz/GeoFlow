/**
 * Tabla inicial de parámetros de viáticos y cálculo puro de desglose operativo.
 * Todas las tarifas parten explícitamente en PENDIENTE_CONFIRMAR (sin montos inventados).
 * Sin dependencias de React ni de Supabase.
 */
import type {
  CodigoParametroViatico,
  EntradaEstimacionViaticos,
  LineaDesgloseViatico,
  ParametroViatico,
  ResultadoEstimacionViaticos,
  TipoServicioLevantamiento,
  TopografiaTerreno,
} from './types';

export const ETIQUETAS_SERVICIO: Record<
  TipoServicioLevantamiento,
  { titulo: string; subtitulo: string }
> = {
  rtk: { titulo: 'RTK', subtitulo: 'Topografía GNSS' },
  dron_lidar: { titulo: 'Dron & LiDAR', subtitulo: 'Fotogrametría MDT' },
  deslinde: { titulo: 'Deslinde', subtitulo: 'Catastro Ley 108-05' },
  ingenieria: { titulo: 'Ingeniería', subtitulo: 'Vial y Nivelación' },
  arquitectura: { titulo: 'Arquitectura', subtitulo: 'Diseño BIM / R-001' },
};

export const ETIQUETAS_TOPOGRAFIA: Record<TopografiaTerreno, string> = {
  llano: 'Llano',
  ondulado: 'Ondulado',
  montanoso: 'Montañoso',
};

export const PARAMETROS_VIATICOS_INICIALES: ParametroViatico[] = [
  {
    codigo: 'jornada_rtk',
    concepto: 'Jornada de Brigada GNSS / RTK',
    unidad: 'RD$ / día',
    monto_rd: null,
    estado: 'PENDIENTE_CONFIRMAR',
  },
  {
    codigo: 'jornada_dron_lidar',
    concepto: 'Jornada de Vuelo Dron & LiDAR',
    unidad: 'RD$ / día',
    monto_rd: null,
    estado: 'PENDIENTE_CONFIRMAR',
  },
  {
    codigo: 'jornada_deslinde',
    concepto: 'Jornada de Brigada Deslinde (Ley 108-05)',
    unidad: 'RD$ / día',
    monto_rd: null,
    estado: 'PENDIENTE_CONFIRMAR',
  },
  {
    codigo: 'jornada_ingenieria',
    concepto: 'Jornada de Ingeniería Vial y Nivelación',
    unidad: 'RD$ / día',
    monto_rd: null,
    estado: 'PENDIENTE_CONFIRMAR',
  },
  {
    codigo: 'jornada_arquitectura',
    concepto: 'Jornada de Brigada Arquitectura',
    unidad: 'RD$ / día',
    monto_rd: null,
    estado: 'PENDIENTE_CONFIRMAR',
  },
  {
    codigo: 'movilizacion_km',
    concepto: 'Movilización vehicular (ida y vuelta)',
    unidad: 'RD$ / km',
    monto_rd: null,
    estado: 'PENDIENTE_CONFIRMAR',
  },
  {
    codigo: 'dieta_tecnico_dia',
    concepto: 'Viáticos y dieta por técnico en campo',
    unidad: 'RD$ / técnico / día',
    monto_rd: null,
    estado: 'PENDIENTE_CONFIRMAR',
  },
  {
    codigo: 'gabinete_cad',
    concepto: 'Gabinete CAD y procesamiento de planos',
    unidad: 'RD$ / trabajo',
    monto_rd: null,
    estado: 'PENDIENTE_CONFIRMAR',
  },
];

function codigoServicio(
  servicio: TipoServicioLevantamiento
): CodigoParametroViatico {
  switch (servicio) {
    case 'rtk':
      return 'jornada_rtk';
    case 'dron_lidar':
      return 'jornada_dron_lidar';
    case 'deslinde':
      return 'jornada_deslinde';
    case 'ingenieria':
      return 'jornada_ingenieria';
    case 'arquitectura':
      return 'jornada_arquitectura';
  }
}

function obtenerParametro(
  parametros: ParametroViatico[],
  codigo: CodigoParametroViatico
): ParametroViatico {
  return (
    parametros.find((p) => p.codigo === codigo) ??
    PARAMETROS_VIATICOS_INICIALES.find((p) => p.codigo === codigo)!
  );
}

/**
 * Calcula el desglose de brigada, movilización/viáticos y gabinete.
 * Si algún parámetro aplicable está en PENDIENTE_CONFIRMAR (o monto_rd es null),
 * no inventa montos y marca la línea y el total como PENDIENTE_CONFIRMAR.
 */
export function calcularEstimacionViaticos(
  entrada: EntradaEstimacionViaticos,
  parametros: ParametroViatico[] = PARAMETROS_VIATICOS_INICIALES
): ResultadoEstimacionViaticos {
  const dias = Math.max(1, Math.round(entrada.dias_campo));
  const tecnicos = Math.max(1, Math.round(entrada.cantidad_tecnicos));
  const distanciaIdaVueltaKm = Math.max(0, entrada.distancia_ida_km * 2);

  const codJornada = codigoServicio(entrada.servicio);
  const pJornada = obtenerParametro(parametros, codJornada);
  const pMovilizacion = obtenerParametro(parametros, 'movilizacion_km');
  const pDieta = obtenerParametro(parametros, 'dieta_tecnico_dia');
  const pGabinete = obtenerParametro(parametros, 'gabinete_cad');

  const pendientes: CodigoParametroViatico[] = [];

  // 1. Jornada de brigada
  let lineaJornada: LineaDesgloseViatico;
  if (pJornada.estado === 'confirmada' && pJornada.monto_rd !== null) {
    lineaJornada = {
      codigo: codJornada,
      concepto: `1. ${pJornada.concepto}`,
      detalle: `${dias} día(s) · Terreno ${ETIQUETAS_TOPOGRAFIA[entrada.topografia].toLowerCase()}`,
      monto_rd: Number((pJornada.monto_rd * dias).toFixed(2)),
      estado: 'confirmada',
    };
  } else {
    pendientes.push(codJornada);
    lineaJornada = {
      codigo: codJornada,
      concepto: `1. ${pJornada.concepto}`,
      detalle: `${dias} día(s) · Tarifa PENDIENTE_CONFIRMAR`,
      monto_rd: null,
      estado: 'PENDIENTE_CONFIRMAR',
    };
  }

  // 2. Movilización y viáticos técnicos
  const faltaMovilizacion =
    pMovilizacion.estado !== 'confirmada' || pMovilizacion.monto_rd === null;
  const faltaDieta = pDieta.estado !== 'confirmada' || pDieta.monto_rd === null;

  if (faltaMovilizacion) pendientes.push('movilizacion_km');
  if (faltaDieta) pendientes.push('dieta_tecnico_dia');

  let lineaViaticos: LineaDesgloseViatico;
  if (!faltaMovilizacion && !faltaDieta) {
    const costoKm = pMovilizacion.monto_rd! * distanciaIdaVueltaKm;
    const costoDietas = pDieta.monto_rd! * tecnicos * dias;
    lineaViaticos = {
      codigo: 'dieta_tecnico_dia',
      concepto: '2. Movilización y Viáticos Técnicos',
      detalle: `${distanciaIdaVueltaKm.toFixed(1)} km ida/vuelta · ${tecnicos} técnico(s) × ${dias} día(s)`,
      monto_rd: Number((costoKm + costoDietas).toFixed(2)),
      estado: 'confirmada',
    };
  } else {
    lineaViaticos = {
      codigo: 'dieta_tecnico_dia',
      concepto: '2. Movilización y Viáticos Técnicos',
      detalle: `${distanciaIdaVueltaKm.toFixed(1)} km ida/vuelta · ${tecnicos} técnico(s) · PENDIENTE_CONFIRMAR`,
      monto_rd: null,
      estado: 'PENDIENTE_CONFIRMAR',
    };
  }

  // 3. Gabinete CAD
  let lineaGabinete: LineaDesgloseViatico;
  if (!entrada.incluir_gabinete) {
    lineaGabinete = {
      codigo: 'gabinete_cad',
      concepto: '3. Gabinete CAD y Procesamiento',
      detalle: 'No incluido en esta estimación',
      monto_rd: 0,
      estado: 'confirmada',
    };
  } else if (pGabinete.estado === 'confirmada' && pGabinete.monto_rd !== null) {
    lineaGabinete = {
      codigo: 'gabinete_cad',
      concepto: '3. Gabinete CAD y Procesamiento',
      detalle: 'Procesamiento y entrega de planos',
      monto_rd: Number(pGabinete.monto_rd.toFixed(2)),
      estado: 'confirmada',
    };
  } else {
    pendientes.push('gabinete_cad');
    lineaGabinete = {
      codigo: 'gabinete_cad',
      concepto: '3. Gabinete CAD y Procesamiento',
      detalle: 'Tarifa PENDIENTE_CONFIRMAR',
      monto_rd: null,
      estado: 'PENDIENTE_CONFIRMAR',
    };
  }

  const lineas = [lineaJornada, lineaViaticos, lineaGabinete];
  const todoConfirmado = pendientes.length === 0;
  const total_rd = todoConfirmado
    ? Number(
        lineas.reduce((acc, item) => acc + (item.monto_rd ?? 0), 0).toFixed(2)
      )
    : null;

  return {
    lineas,
    total_rd,
    estado_total: todoConfirmado ? 'confirmada' : 'PENDIENTE_CONFIRMAR',
    parametros_pendientes: pendientes,
  };
}
