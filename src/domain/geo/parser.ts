/**
 * Funciones de compatibilidad directa para parseo de un polígono único.
 * Delega el procesamiento completo al servicio `kmzService.ts`.
 */
import {
  extraerPoligonosGeoJSON,
  extraerPoligonosKML,
  procesarArchivoKMZOGeo,
  procesarKMZ,
} from './kmzService';
import type { PoligonoParseado } from './types';

export function parsearKML(
  kmlTexto: string,
  nombreArchivo = 'poligono.kml'
): PoligonoParseado {
  return extraerPoligonosKML(kmlTexto, nombreArchivo).poligonoPrincipal;
}

export function parsearGeoJSON(
  jsonTexto: string,
  nombreArchivo = 'poligono.geojson'
): PoligonoParseado {
  return extraerPoligonosGeoJSON(jsonTexto, nombreArchivo).poligonoPrincipal;
}

export async function parsearKMZBuffer(
  buffer: ArrayBuffer | Uint8Array,
  nombreArchivo = 'poligono.kmz'
): Promise<PoligonoParseado> {
  const res = await procesarKMZ(buffer, nombreArchivo);
  return res.poligonoPrincipal;
}

export async function parsearArchivoGeoespacial(archivo: {
  name: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
}): Promise<PoligonoParseado> {
  const res = await procesarArchivoKMZOGeo(archivo);
  return res.poligonoPrincipal;
}
