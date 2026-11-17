/**
 * Cálculos geoespaciales puros (área, perímetro, centroide, cuadro de rumbos
 * y detección aproximada de provincia en República Dominicana).
 * Sin dependencias de React ni de APIs externas.
 */
import type {
  Coordenada,
  MetricasPoligono,
  SupuestoGeoespacial,
  TramoRumbo,
} from './types';

/** Equivalencia tradicional en República Dominicana: 1 tarea = 628.863 m² */
export const EQUIVALENCIA_TAREA_RD_M2 = 628.863;

/** Sede base por defecto (Santo Domingo) usada como supuesto para distancia logística en línea recta */
export const SEDE_BASE_SUPUESTO: Coordenada = {
  lat: 18.4861,
  lng: -69.9312,
};

export const SUPUESTOS_GEOESPACIAL: SupuestoGeoespacial[] = [
  {
    clave: 'unidades_area',
    titulo: 'Unidades de superficie',
    opcion_propuesta:
      'Metros cuadrados (m²), Tareas dominicanas (1 tarea = 628.863 m²) y Hectáreas (10,000 m²).',
    estado: 'SUPUESTO_PENDIENTE',
  },
  {
    clave: 'proveedor_mapas',
    titulo: 'Proveedor de mapa satelital base',
    opcion_propuesta:
      'Visor vectorial local sin conexión (SVG) activo por defecto; proveedor satelital (Google Maps o Leaflet/OSM) pendiente de confirmación.',
    estado: 'SUPUESTO_PENDIENTE',
  },
  {
    clave: 'distancia_y_provincia',
    titulo: 'Detección de provincia y distancia logística',
    opcion_propuesta:
      'Estimación por centroide respecto a las 32 provincias de RD y distancia geodésica desde Santo Domingo (sin ruteo vial aún).',
    estado: 'SUPUESTO_PENDIENTE',
  },
];

interface ProvinciaCentroid {
  nombre: string;
  lat: number;
  lng: number;
}

export const PROVINCIAS_RD: ProvinciaCentroid[] = [
  { nombre: 'Distrito Nacional', lat: 18.4861, lng: -69.9312 },
  { nombre: 'Santo Domingo', lat: 18.5001, lng: -69.8568 },
  { nombre: 'Santiago', lat: 19.4517, lng: -70.697 },
  { nombre: 'La Altagracia', lat: 18.615, lng: -68.707 },
  { nombre: 'La Romana', lat: 18.4273, lng: -68.9728 },
  { nombre: 'San Pedro de Macorís', lat: 18.4539, lng: -69.3086 },
  { nombre: 'La Vega', lat: 19.2221, lng: -70.5296 },
  { nombre: 'Puerto Plata', lat: 19.7934, lng: -70.6884 },
  { nombre: 'San Cristóbal', lat: 18.4167, lng: -70.1 },
  { nombre: 'Duarte', lat: 19.3009, lng: -70.2526 },
  { nombre: 'Espaillat', lat: 19.3935, lng: -70.5259 },
  { nombre: 'Azua', lat: 18.4532, lng: -70.7349 },
  { nombre: 'Barahona', lat: 18.2085, lng: -71.1008 },
  { nombre: 'Peravia', lat: 18.2796, lng: -70.3319 },
  { nombre: 'Monseñor Nouel', lat: 18.9369, lng: -70.4092 },
  { nombre: 'Monte Plata', lat: 18.807, lng: -69.784 },
  { nombre: 'Samaná', lat: 19.2056, lng: -69.3369 },
  { nombre: 'María Trinidad Sánchez', lat: 19.3734, lng: -69.8514 },
  { nombre: 'Sánchez Ramírez', lat: 19.0527, lng: -70.1492 },
  { nombre: 'San Juan', lat: 18.8059, lng: -71.2299 },
  { nombre: 'Valverde', lat: 19.5519, lng: -71.0781 },
  { nombre: 'Monte Cristi', lat: 19.8483, lng: -71.646 },
  { nombre: 'Hato Mayor', lat: 18.7628, lng: -69.2568 },
  { nombre: 'El Seibo', lat: 18.7656, lng: -69.0389 },
  { nombre: 'San José de Ocoa', lat: 18.5466, lng: -70.5063 },
  { nombre: 'Hermanas Mirabal', lat: 19.3748, lng: -70.358 },
  { nombre: 'Dajabón', lat: 19.5488, lng: -71.7083 },
  { nombre: 'Santiago Rodríguez', lat: 19.4713, lng: -71.3413 },
  { nombre: 'Elías Piña', lat: 18.8775, lng: -71.7046 },
  { nombre: 'Bahoruco', lat: 18.4879, lng: -71.4182 },
  { nombre: 'Independencia', lat: 18.4825, lng: -71.8502 },
  { nombre: 'Pedernales', lat: 18.0384, lng: -71.744 },
];

const RADIO_TIERRA_M = 6371000;

function aRadianes(grados: number): number {
  return (grados * Math.PI) / 180;
}

function aGrados(radianes: number): number {
  return (radianes * 180) / Math.PI;
}

/** Distancia geodésica entre dos coordenadas (fórmula de Haversine) en metros */
export function calcularDistanciaHaversineM(
  a: Coordenada,
  b: Coordenada
): number {
  const dLat = aRadianes(b.lat - a.lat);
  const dLng = aRadianes(b.lng - a.lng);
  const lat1 = aRadianes(a.lat);
  const lat2 = aRadianes(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Limpia un anillo cerrado eliminando el último punto si coincide con el primero */
export function normalizarAnilloAbierto(vertices: Coordenada[]): Coordenada[] {
  if (vertices.length < 2) return vertices;
  const primero = vertices[0];
  const ultimo = vertices[vertices.length - 1];
  const iguales =
    Math.abs(primero.lat - ultimo.lat) < 1e-9 &&
    Math.abs(primero.lng - ultimo.lng) < 1e-9;
  return iguales ? vertices.slice(0, -1) : vertices;
}

/** Centroide geométrico simple de los vértices */
export function calcularCentroide(vertices: Coordenada[]): Coordenada {
  const limpios = normalizarAnilloAbierto(vertices);
  if (limpios.length === 0) return { ...SEDE_BASE_SUPUESTO };
  const suma = limpios.reduce(
    (acc, v) => ({ lat: acc.lat + v.lat, lng: acc.lng + v.lng }),
    { lat: 0, lng: 0 }
  );
  return {
    lat: suma.lat / limpios.length,
    lng: suma.lng / limpios.length,
  };
}

/** Formatea un azimut (0..360) en rumbo topográfico cuadrantal (ej. N 45° 12' 30" E) */
export function formatearAzimutARumbo(azimutGrados: number): string {
  const az = ((azimutGrados % 360) + 360) % 360;
  let prefijo = 'N';
  let sufijo = 'E';
  let angulo = az;

  if (az >= 0 && az < 90) {
    prefijo = 'N';
    sufijo = 'E';
    angulo = az;
  } else if (az >= 90 && az < 180) {
    prefijo = 'S';
    sufijo = 'E';
    angulo = 180 - az;
  } else if (az >= 180 && az < 270) {
    prefijo = 'S';
    sufijo = 'W';
    angulo = az - 180;
  } else {
    prefijo = 'N';
    sufijo = 'W';
    angulo = 360 - az;
  }

  const grados = Math.floor(angulo);
  const minutosFloat = (angulo - grados) * 60;
  const minutos = Math.floor(minutosFloat);
  const segundos = Math.round((minutosFloat - minutos) * 60);

  const segFinal = segundos === 60 ? 0 : segundos;
  const minFinal = segundos === 60 ? minutos + 1 : minutos;

  return `${prefijo} ${String(grados).padStart(2, '0')}° ${String(minFinal).padStart(2, '0')}' ${String(segFinal).padStart(2, '0')}" ${sufijo}`;
}

/** Calcula azimut geodésico inicial entre dos coordenadas en grados (0..360) */
export function calcularAzimutGrados(a: Coordenada, b: Coordenada): number {
  const lat1 = aRadianes(a.lat);
  const lat2 = aRadianes(b.lat);
  const dLng = aRadianes(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((aGrados(Math.atan2(y, x)) % 360) + 360) % 360;
}

/** Calcula área (m², tareas RD, hectáreas), perímetro, centroide y cuadro de rumbos */
export function calcularMetricasPoligono(
  verticesEntrada: Coordenada[]
): MetricasPoligono {
  const vertices = normalizarAnilloAbierto(verticesEntrada);
  if (vertices.length < 3) {
    throw new Error('Un polígono requiere al menos 3 vértices válidos.');
  }

  const centroide = calcularCentroide(vertices);
  const latRefRad = aRadianes(centroide.lat);
  const metrosPorGradoLat = 111132.92 - 559.82 * Math.cos(2 * latRefRad);
  const metrosPorGradoLng =
    111412.84 * Math.cos(latRefRad) - 93.5 * Math.cos(3 * latRefRad);

  const proyectados = vertices.map((v) => ({
    x: (v.lng - centroide.lng) * metrosPorGradoLng,
    y: (v.lat - centroide.lat) * metrosPorGradoLat,
  }));

  let dobleArea = 0;
  let perimetroM = 0;
  const rumbos: TramoRumbo[] = [];

  for (let i = 0; i < vertices.length; i++) {
    const siguiente = (i + 1) % vertices.length;
    const p1 = proyectados[i];
    const p2 = proyectados[siguiente];
    dobleArea += p1.x * p2.y - p2.x * p1.y;

    const v1 = vertices[i];
    const v2 = vertices[siguiente];
    const distancia = calcularDistanciaHaversineM(v1, v2);
    const azimut = calcularAzimutGrados(v1, v2);
    perimetroM += distancia;

    rumbos.push({
      desde: i + 1,
      hasta: siguiente + 1,
      distancia_m: Number(distancia.toFixed(2)),
      azimut_grados: Number(azimut.toFixed(4)),
      rumbo_texto: formatearAzimutARumbo(azimut),
    });
  }

  const areaM2 = Math.abs(dobleArea) / 2;

  return {
    area_m2: Number(areaM2.toFixed(2)),
    area_tareas_rd: Number((areaM2 / EQUIVALENCIA_TAREA_RD_M2).toFixed(2)),
    area_hectareas: Number((areaM2 / 10000).toFixed(4)),
    perimetro_m: Number(perimetroM.toFixed(2)),
    perimetro_km: Number((perimetroM / 1000).toFixed(3)),
    centroide,
    rumbos,
  };
}

/** Estima la provincia más cercana al centroide (supuesto aproximado) */
export function detectarProvinciaAproximada(centroide: Coordenada): string {
  let mejorNombre = PROVINCIAS_RD[0].nombre;
  let mejorDist = Number.POSITIVE_INFINITY;

  for (const prov of PROVINCIAS_RD) {
    const d = calcularDistanciaHaversineM(centroide, {
      lat: prov.lat,
      lng: prov.lng,
    });
    if (d < mejorDist) {
      mejorDist = d;
      mejorNombre = prov.nombre;
    }
  }
  return mejorNombre;
}

export function calcularDistanciaDesdeSedeKm(
  destino: Coordenada,
  origen: Coordenada = SEDE_BASE_SUPUESTO
): number {
  return Number((calcularDistanciaHaversineM(origen, destino) / 1000).toFixed(1));
}
