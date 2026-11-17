/**
 * Tipos de dominio puros para el módulo geoespacial (parseo KMZ/KML/GeoJSON,
 * cálculo de área, perímetro, cuadro de rumbos y supuestos pendientes).
 * Sin dependencias de React ni de Supabase.
 */

export type FormatoGeoespacial = 'kmz' | 'kml' | 'geojson';

export type UnidadArea = 'm2' | 'tareas_rd' | 'hectareas';

export interface Coordenada {
  lat: number;
  lng: number;
}

export interface VerticePoligono extends Coordenada {
  indice: number;
}

export interface TramoRumbo {
  desde: number;
  hasta: number;
  distancia_m: number;
  azimut_grados: number;
  rumbo_texto: string;
}

export interface MetricasPoligono {
  area_m2: number;
  area_tareas_rd: number;
  area_hectareas: number;
  perimetro_m: number;
  perimetro_km: number;
  centroide: Coordenada;
  rumbos: TramoRumbo[];
}

export type OrigenGeometria = 'polygon' | 'linearring' | 'linestring';

export interface PoligonoParseado {
  nombre: string;
  formato: FormatoGeoespacial;
  origen?: OrigenGeometria;
  vertices: Coordenada[];
  metricas: MetricasPoligono;
  provincia_sugerida: string;
  distancia_desde_sede_km: number;
  geojson: {
    type: 'Feature';
    properties: Record<string, unknown>;
    geometry: {
      type: 'Polygon';
      coordinates: number[][][];
    };
  };
}

export interface ResultadoParsingGeoespacial {
  archivo: string;
  formato: FormatoGeoespacial;
  poligonoPrincipal: PoligonoParseado;
  poligonos: PoligonoParseado[];
  advertencias: string[];
}

export interface SupuestoGeoespacial {
  clave: string;
  titulo: string;
  opcion_propuesta: string;
  estado: 'SUPUESTO_PENDIENTE';
}
