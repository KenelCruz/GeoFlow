/**
 * Servicio puro de parsing geoespacial para archivos .KMZ, .KML y .GeoJSON.
 * Extrae polígonos de límites de terreno (múltiples Placemarks/parcelas,
 * outerBoundaryIs sin confundir huecos innerBoundaryIs, LinearRing y LineString cerrados).
 * Sin dependencias de React ni de Supabase.
 */
import JSZip from 'jszip';
import {
  calcularDistanciaDesdeSedeKm,
  calcularMetricasPoligono,
  detectarProvinciaAproximada,
  normalizarAnilloAbierto,
} from './calculos';
import type {
  Coordenada,
  FormatoGeoespacial,
  OrigenGeometria,
  PoligonoParseado,
  ResultadoParsingGeoespacial,
} from './types';

function validarCoordenada(lng: number, lat: number): Coordenada | null {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function parsearListaCoordenadasKml(texto: string): Coordenada[] {
  const tokens = texto.trim().split(/\s+/);
  const coords: Coordenada[] = [];
  for (const token of tokens) {
    if (!token) continue;
    const partes = token.split(',');
    if (partes.length < 2) continue;
    const lng = Number(partes[0]);
    const lat = Number(partes[1]);
    const punto = validarCoordenada(lng, lat);
    if (punto) coords.push(punto);
  }
  return normalizarAnilloAbierto(coords);
}

function construirPoligono(
  vertices: Coordenada[],
  nombre: string,
  formato: FormatoGeoespacial,
  origen: OrigenGeometria
): PoligonoParseado | null {
  if (vertices.length < 3) return null;
  const metricas = calcularMetricasPoligono(vertices);
  if (metricas.area_m2 <= 0) return null;

  const provincia_sugerida = detectarProvinciaAproximada(metricas.centroide);
  const distancia_desde_sede_km = calcularDistanciaDesdeSedeKm(
    metricas.centroide
  );
  const anilloCerrado = [...vertices, vertices[0]].map((v) => [v.lng, v.lat]);

  return {
    nombre,
    formato,
    origen,
    vertices,
    metricas,
    provincia_sugerida,
    distancia_desde_sede_km,
    geojson: {
      type: 'Feature',
      properties: {
        nombre,
        origen,
        area_m2: metricas.area_m2,
        perimetro_m: metricas.perimetro_m,
        provincia_sugerida,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [anilloCerrado],
      },
    },
  };
}

interface CandidatoGeometria {
  nombre: string;
  vertices: Coordenada[];
  origen: OrigenGeometria;
}

function limpiarNombreXml(texto: string | null | undefined, respaldo: string): string {
  if (!texto) return respaldo;
  const limpio = texto.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
  return limpio || respaldo;
}

function extraerCandidatosConDOMParser(
  kmlTexto: string,
  nombreBase: string
): CandidatoGeometria[] {
  const doc = new DOMParser().parseFromString(kmlTexto, 'application/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('El documento KML contiene XML mal formado.');
  }

  const docNameEl = doc.querySelector('Document > name');
  const nombreDoc = limpiarNombreXml(docNameEl?.textContent, nombreBase);
  const placemarks = Array.from(doc.getElementsByTagName('Placemark'));
  const candidatos: CandidatoGeometria[] = [];

  const procesarContenedor = (contenedor: Element, nombreContenedor: string) => {
    const polygons = Array.from(contenedor.getElementsByTagName('Polygon'));
    let idx = 0;

    for (const poly of polygons) {
      const outer = poly.getElementsByTagName('outerBoundaryIs')[0];
      const coordEl = outer
        ? outer.getElementsByTagName('coordinates')[0]
        : poly.getElementsByTagName('coordinates')[0];
      if (!coordEl) continue;

      const vertices = parsearListaCoordenadasKml(coordEl.textContent ?? '');
      if (vertices.length >= 3) {
        idx += 1;
        candidatos.push({
          nombre:
            polygons.length > 1 ? `${nombreContenedor} (${idx})` : nombreContenedor,
          vertices,
          origen: 'polygon',
        });
      }
    }

    if (idx > 0) return;

    // Si no hubo <Polygon>, busca <LinearRing> independientes (sin innerBoundaryIs)
    const rings = Array.from(contenedor.getElementsByTagName('LinearRing'));
    for (const ring of rings) {
      if (ring.closest('innerBoundaryIs')) continue;
      const coordEl = ring.getElementsByTagName('coordinates')[0];
      if (!coordEl) continue;
      const vertices = parsearListaCoordenadasKml(coordEl.textContent ?? '');
      if (vertices.length >= 3) {
        idx += 1;
        candidatos.push({
          nombre:
            rings.length > 1 ? `${nombreContenedor} (${idx})` : nombreContenedor,
          vertices,
          origen: 'linearring',
        });
      }
    }

    if (idx > 0) return;

    // Respaldo para exportaciones CAD/GPS que guardan el lindero como <LineString>
    const lines = Array.from(contenedor.getElementsByTagName('LineString'));
    for (const line of lines) {
      const coordEl = line.getElementsByTagName('coordinates')[0];
      if (!coordEl) continue;
      const vertices = parsearListaCoordenadasKml(coordEl.textContent ?? '');
      if (vertices.length >= 3) {
        idx += 1;
        candidatos.push({
          nombre:
            lines.length > 1 ? `${nombreContenedor} (${idx})` : nombreContenedor,
          vertices,
          origen: 'linestring',
        });
      }
    }
  };

  if (placemarks.length > 0) {
    placemarks.forEach((pm, i) => {
      const nameEl = Array.from(pm.children).find(
        (c) => c.localName === 'name' || c.tagName === 'name'
      );
      const fallback = placemarks.length > 1 ? `Parcela ${i + 1}` : nombreDoc;
      const pmNombre = limpiarNombreXml(nameEl?.textContent, fallback);
      procesarContenedor(pm, pmNombre);
    });
  } else if (doc.documentElement) {
    procesarContenedor(doc.documentElement, nombreDoc);
  }

  return candidatos;
}

function extraerBloquesTag(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const resultados: string[] = [];
  let match: RegExpExecArray | null = regex.exec(xml);
  while (match !== null) {
    resultados.push(match[1]);
    match = regex.exec(xml);
  }
  return resultados;
}

function extraerCandidatosRegex(
  kmlTexto: string,
  nombreBase: string
): CandidatoGeometria[] {
  const docNameMatch = kmlTexto.match(/<Document[^>]*>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>/i);
  const nombreDoc = limpiarNombreXml(docNameMatch?.[1], nombreBase);
  const placemarks = extraerBloquesTag(kmlTexto, 'Placemark');
  const candidatos: CandidatoGeometria[] = [];

  const procesarBloque = (bloque: string, nombreBloque: string) => {
    const polygons = extraerBloquesTag(bloque, 'Polygon');
    let idx = 0;

    for (const poly of polygons) {
      const outer = extraerBloquesTag(poly, 'outerBoundaryIs')[0] ?? poly;
      const coordsTexto = extraerBloquesTag(outer, 'coordinates')[0] ?? '';
      const vertices = parsearListaCoordenadasKml(coordsTexto);
      if (vertices.length >= 3) {
        idx += 1;
        candidatos.push({
          nombre:
            polygons.length > 1 ? `${nombreBloque} (${idx})` : nombreBloque,
          vertices,
          origen: 'polygon',
        });
      }
    }

    if (idx > 0) return;

    const sinInner = bloque.replace(
      /<innerBoundaryIs\b[^>]*>[\s\S]*?<\/innerBoundaryIs>/gi,
      ''
    );
    const rings = extraerBloquesTag(sinInner, 'LinearRing');
    for (const ring of rings) {
      const coordsTexto = extraerBloquesTag(ring, 'coordinates')[0] ?? '';
      const vertices = parsearListaCoordenadasKml(coordsTexto);
      if (vertices.length >= 3) {
        idx += 1;
        candidatos.push({
          nombre: rings.length > 1 ? `${nombreBloque} (${idx})` : nombreBloque,
          vertices,
          origen: 'linearring',
        });
      }
    }

    if (idx > 0) return;

    const lines = extraerBloquesTag(bloque, 'LineString');
    for (const line of lines) {
      const coordsTexto = extraerBloquesTag(line, 'coordinates')[0] ?? '';
      const vertices = parsearListaCoordenadasKml(coordsTexto);
      if (vertices.length >= 3) {
        idx += 1;
        candidatos.push({
          nombre: lines.length > 1 ? `${nombreBloque} (${idx})` : nombreBloque,
          vertices,
          origen: 'linestring',
        });
      }
    }
  };

  if (placemarks.length > 0) {
    placemarks.forEach((pm, i) => {
      const nameMatch = pm.match(/<name[^>]*>([\s\S]*?)<\/name>/i);
      const fallback = placemarks.length > 1 ? `Parcela ${i + 1}` : nombreDoc;
      const pmNombre = limpiarNombreXml(nameMatch?.[1], fallback);
      procesarBloque(pm, pmNombre);
    });
  } else {
    procesarBloque(kmlTexto, nombreDoc);
  }

  return candidatos;
}

function construirResultado(
  candidatos: CandidatoGeometria[],
  nombreArchivo: string,
  formato: FormatoGeoespacial
): ResultadoParsingGeoespacial {
  const poligonos: PoligonoParseado[] = [];
  const advertencias: string[] = [];

  for (const cand of candidatos) {
    const poli = construirPoligono(
      cand.vertices,
      cand.nombre,
      formato,
      cand.origen
    );
    if (poli) {
      poligonos.push(poli);
    }
  }

  if (poligonos.length === 0) {
    throw new Error(
      `No se encontró ningún polígono válido de límites de terreno (≥ 3 vértices y área > 0) en el archivo ${formato.toUpperCase()}.`
    );
  }

  if (poligonos.some((p) => p.origen === 'linestring')) {
    advertencias.push(
      'Al menos un lindero proviene de una polilínea (LineString) cerrada automáticamente como polígono.'
    );
  }

  const poligonoPrincipal = poligonos.reduce((mayor, actual) =>
    actual.metricas.area_m2 > mayor.metricas.area_m2 ? actual : mayor
  );

  return {
    archivo: nombreArchivo,
    formato,
    poligonoPrincipal,
    poligonos,
    advertencias,
  };
}

/** Extrae todos los polígonos de límites de terreno de un documento KML */
export function extraerPoligonosKML(
  kmlTexto: string,
  nombreArchivo = 'poligono.kml'
): ResultadoParsingGeoespacial {
  const candidatos =
    typeof DOMParser !== 'undefined'
      ? extraerCandidatosConDOMParser(kmlTexto, nombreArchivo)
      : extraerCandidatosRegex(kmlTexto, nombreArchivo);

  return construirResultado(candidatos, nombreArchivo, 'kml');
}

function extraerAnillosGeoJson(
  geometry: unknown
): Array<{ vertices: Coordenada[]; origen: OrigenGeometria }> {
  if (!geometry || typeof geometry !== 'object') return [];
  const geo = geometry as { type?: string; coordinates?: unknown };

  const convertirAnillo = (anillo: unknown): Coordenada[] => {
    if (!Array.isArray(anillo)) return [];
    const puntos: Coordenada[] = [];
    for (const par of anillo) {
      if (Array.isArray(par) && par.length >= 2) {
        const p = validarCoordenada(Number(par[0]), Number(par[1]));
        if (p) puntos.push(p);
      }
    }
    return normalizarAnilloAbierto(puntos);
  };

  if (geo.type === 'Polygon' && Array.isArray(geo.coordinates)) {
    const vertices = convertirAnillo(geo.coordinates[0]);
    return vertices.length >= 3 ? [{ vertices, origen: 'polygon' }] : [];
  }

  if (geo.type === 'MultiPolygon' && Array.isArray(geo.coordinates)) {
    const salida: Array<{ vertices: Coordenada[]; origen: OrigenGeometria }> = [];
    for (const poli of geo.coordinates) {
      if (Array.isArray(poli) && poli.length > 0) {
        const vertices = convertirAnillo(poli[0]);
        if (vertices.length >= 3) {
          salida.push({ vertices, origen: 'polygon' });
        }
      }
    }
    return salida;
  }

  if (geo.type === 'LineString' && Array.isArray(geo.coordinates)) {
    const vertices = convertirAnillo(geo.coordinates);
    return vertices.length >= 3 ? [{ vertices, origen: 'linestring' }] : [];
  }

  return [];
}

/** Extrae todos los polígonos de un documento GeoJSON */
export function extraerPoligonosGeoJSON(
  jsonTexto: string,
  nombreArchivo = 'poligono.geojson'
): ResultadoParsingGeoespacial {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonTexto);
  } catch {
    throw new Error('El archivo GeoJSON no contiene un JSON válido.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Estructura GeoJSON inválida.');
  }

  const obj = parsed as {
    type?: string;
    geometry?: unknown;
    properties?: Record<string, unknown>;
    features?: Array<{ geometry?: unknown; properties?: Record<string, unknown> }>;
  };

  const candidatos: CandidatoGeometria[] = [];

  if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
    obj.features.forEach((feat, i) => {
      const anillos = extraerAnillosGeoJson(feat.geometry);
      const baseNombre =
        typeof feat.properties?.name === 'string' && feat.properties.name.trim()
          ? feat.properties.name.trim()
          : obj.features!.length > 1
            ? `Parcela ${i + 1}`
            : nombreArchivo;

      anillos.forEach((a, j) => {
        candidatos.push({
          nombre: anillos.length > 1 ? `${baseNombre} (${j + 1})` : baseNombre,
          vertices: a.vertices,
          origen: a.origen,
        });
      });
    });
  } else if (obj.type === 'Feature') {
    const baseNombre =
      typeof obj.properties?.name === 'string' && obj.properties.name.trim()
        ? obj.properties.name.trim()
        : nombreArchivo;
    const anillos = extraerAnillosGeoJson(obj.geometry);
    anillos.forEach((a, j) => {
      candidatos.push({
        nombre: anillos.length > 1 ? `${baseNombre} (${j + 1})` : baseNombre,
        vertices: a.vertices,
        origen: a.origen,
      });
    });
  } else {
    const anillos = extraerAnillosGeoJson(obj);
    anillos.forEach((a, j) => {
      candidatos.push({
        nombre:
          anillos.length > 1 ? `${nombreArchivo} (${j + 1})` : nombreArchivo,
        vertices: a.vertices,
        origen: a.origen,
      });
    });
  }

  return construirResultado(candidatos, nombreArchivo, 'geojson');
}

/**
 * Descomprime un archivo .KMZ en memoria, prioriza `doc.kml` según la especificación KML,
 * y extrae todos los polígonos de límites de terreno.
 */
export async function procesarKMZ(
  buffer: ArrayBuffer | Uint8Array,
  nombreArchivo = 'poligono.kmz'
): Promise<ResultadoParsingGeoespacial> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error(
      'El archivo .KMZ está dañado o no es un contenedor ZIP válido.'
    );
  }

  const kmlEntries = Object.values(zip.files).filter(
    (entry) => !entry.dir && entry.name.toLowerCase().endsWith('.kml')
  );

  if (kmlEntries.length === 0) {
    throw new Error('El archivo .KMZ no contiene ningún documento .KML interno.');
  }

  // Priorizar doc.kml en la raíz según estándar OGC KML
  const entradaPrincipal =
    kmlEntries.find((e) => e.name.toLowerCase() === 'doc.kml') ??
    kmlEntries.find((e) => e.name.toLowerCase().endsWith('/doc.kml')) ??
    kmlEntries[0];

  const kmlTexto = await entradaPrincipal.async('string');
  const resultadoKml = extraerPoligonosKML(kmlTexto, nombreArchivo);

  return {
    ...resultadoKml,
    formato: 'kmz',
    poligonoPrincipal: { ...resultadoKml.poligonoPrincipal, formato: 'kmz' },
    poligonos: resultadoKml.poligonos.map((p) => ({ ...p, formato: 'kmz' })),
  };
}

/** Servicio unificado para procesar archivos .KMZ, .KML o .GeoJSON en navegador */
export async function procesarArchivoKMZOGeo(archivo: {
  name: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
}): Promise<ResultadoParsingGeoespacial> {
  const nombreLower = archivo.name.toLowerCase();
  const buffer = await archivo.arrayBuffer();

  if (nombreLower.endsWith('.kmz')) {
    return procesarKMZ(buffer, archivo.name);
  }

  const texto = new TextDecoder('utf-8').decode(buffer);
  if (nombreLower.endsWith('.kml')) {
    return extraerPoligonosKML(texto, archivo.name);
  }
  if (nombreLower.endsWith('.geojson') || nombreLower.endsWith('.json')) {
    return extraerPoligonosGeoJSON(texto, archivo.name);
  }

  throw new Error(
    'Formato no compatible. Sube un archivo .KMZ, .KML o .GeoJSON.'
  );
}
