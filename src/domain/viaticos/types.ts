/**
 * Tipos de dominio puros para parámetros de viáticos y estimación operativa.
 * Ninguna tarifa comercial se inventa por defecto: inicia en PENDIENTE_CONFIRMAR.
 */

export type TipoServicioLevantamiento =
  | 'rtk'
  | 'dron_lidar'
  | 'deslinde'
  | 'ingenieria'
  | 'arquitectura';

export type TopografiaTerreno = 'llano' | 'ondulado' | 'montanoso';

export type EstadoTarifa = 'PENDIENTE_CONFIRMAR' | 'confirmada';

export type CodigoParametroViatico =
  | 'jornada_rtk'
  | 'jornada_dron_lidar'
  | 'jornada_deslinde'
  | 'jornada_ingenieria'
  | 'jornada_arquitectura'
  | 'movilizacion_km'
  | 'dieta_tecnico_dia'
  | 'gabinete_cad';

export interface ParametroViatico {
  codigo: CodigoParametroViatico;
  concepto: string;
  unidad: string;
  monto_rd: number | null;
  estado: EstadoTarifa;
}

export interface EntradaEstimacionViaticos {
  servicio: TipoServicioLevantamiento;
  topografia: TopografiaTerreno;
  area_m2: number;
  distancia_ida_km: number;
  cantidad_tecnicos: number;
  dias_campo: number;
  incluir_gabinete: boolean;
}

export interface LineaDesgloseViatico {
  codigo: CodigoParametroViatico;
  concepto: string;
  detalle: string;
  monto_rd: number | null;
  estado: EstadoTarifa;
}

export interface ResultadoEstimacionViaticos {
  lineas: LineaDesgloseViatico[];
  total_rd: number | null;
  estado_total: EstadoTarifa;
  parametros_pendientes: CodigoParametroViatico[];
}
