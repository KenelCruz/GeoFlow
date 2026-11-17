import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  calcularMetricasPoligono,
  detectarProvinciaAproximada,
  EQUIVALENCIA_TAREA_RD_M2,
  formatearAzimutARumbo,
} from './calculos';
import {
  extraerPoligonosKML,
  procesarKMZ,
} from './kmzService';
import { parsearGeoJSON, parsearKML, parsearKMZBuffer } from './parser';

const KML_RECTANGULO_EJEMPLO = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Parcela Prueba La Romana</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              -68.9728,18.4273,0
              -68.9723,18.4273,0
              -68.9723,18.4278,0
              -68.9728,18.4278,0
              -68.9728,18.4273,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;

const KML_MULTIPARCELA_Y_HUECO = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Proyecto Ejemplo</name>
    <Placemark>
      <name>Lote A Menor</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              -69.9320,18.4860,0 -69.9317,18.4860,0 -69.9317,18.4863,0 -69.9320,18.4863,0 -69.9320,18.4860,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
        <innerBoundaryIs>
          <LinearRing>
            <coordinates>
              -69.9319,18.4861,0 -69.9318,18.4861,0 -69.9318,18.4862,0 -69.9319,18.4862,0 -69.9319,18.4861,0
            </coordinates>
          </LinearRing>
        </innerBoundaryIs>
      </Polygon>
    </Placemark>
    <Placemark>
      <name>Lote B Principal</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              -69.9310,18.4850,0 -69.9295,18.4850,0 -69.9295,18.4865,0 -69.9310,18.4865,0 -69.9310,18.4850,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;

describe('Cálculos geoespaciales y cuadro de rumbos', () => {
  it('calcula área en m², tareas dominicanas y perímetro de un polígono', () => {
    const metricas = calcularMetricasPoligono([
      { lat: 18.4273, lng: -68.9728 },
      { lat: 18.4273, lng: -68.9723 },
      { lat: 18.4278, lng: -68.9723 },
      { lat: 18.4278, lng: -68.9728 },
    ]);

    expect(metricas.area_m2).toBeGreaterThan(2500);
    expect(metricas.area_m2).toBeLessThan(3500);
    expect(metricas.area_tareas_rd).toBeCloseTo(
      metricas.area_m2 / EQUIVALENCIA_TAREA_RD_M2,
      1
    );
    expect(metricas.perimetro_m).toBeGreaterThan(200);
    expect(metricas.rumbos).toHaveLength(4);
  });

  it('formatea azimut en rumbo cuadrantal topográfico', () => {
    expect(formatearAzimutARumbo(45)).toBe('N 45° 00\' 00" E');
    expect(formatearAzimutARumbo(135)).toBe('S 45° 00\' 00" E');
    expect(formatearAzimutARumbo(225)).toBe('S 45° 00\' 00" W');
    expect(formatearAzimutARumbo(315)).toBe('N 45° 00\' 00" W');
  });

  it('detecta de forma aproximada la provincia correspondiente al centroide', () => {
    expect(detectarProvinciaAproximada({ lat: 18.4275, lng: -68.9725 })).toBe(
      'La Romana'
    );
    expect(detectarProvinciaAproximada({ lat: 19.452, lng: -70.697 })).toBe(
      'Santiago'
    );
  });
});

describe('Servicio de parsing KMZ, KML y GeoJSON', () => {
  it('parsea un archivo KML y calcula métricas y provincia', () => {
    const poligono = parsearKML(KML_RECTANGULO_EJEMPLO);
    expect(poligono.nombre).toBe('Parcela Prueba La Romana');
    expect(poligono.formato).toBe('kml');
    expect(poligono.vertices).toHaveLength(4);
    expect(poligono.provincia_sugerida).toBe('La Romana');
    expect(poligono.geojson.geometry.type).toBe('Polygon');
  });

  it('descomprime y parsea un archivo KMZ priorizando doc.kml y extrayendo múltiples parcelas', async () => {
    const zip = new JSZip();
    zip.file('anexo/secundario.kml', KML_RECTANGULO_EJEMPLO);
    zip.file('doc.kml', KML_MULTIPARCELA_Y_HUECO);
    const buffer = await zip.generateAsync({ type: 'uint8array' });

    const resultado = await procesarKMZ(buffer, 'finca_multiparcels.kmz');
    expect(resultado.formato).toBe('kmz');
    expect(resultado.poligonos).toHaveLength(2);
    expect(resultado.poligonos.map((p) => p.nombre)).toEqual([
      'Lote A Menor',
      'Lote B Principal',
    ]);
    expect(resultado.poligonoPrincipal.nombre).toBe('Lote B Principal');

    const simple = await parsearKMZBuffer(buffer, 'finca_multiparcels.kmz');
    expect(simple.nombre).toBe('Lote B Principal');
  });

  it('extrae linderos exportados como LineString cerrado emitiendo advertencia', () => {
    const kmlLineString = `<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Document>
        <Placemark>
          <name>Lindero Polilínea CAD</name>
          <LineString>
            <coordinates>
              -70.5296,19.2221,0 -70.5290,19.2221,0 -70.5290,19.2227,0 -70.5296,19.2227,0 -70.5296,19.2221,0
            </coordinates>
          </LineString>
        </Placemark>
      </Document>
    </kml>`;

    const resultado = extraerPoligonosKML(kmlLineString);
    expect(resultado.poligonos).toHaveLength(1);
    expect(resultado.poligonoPrincipal.nombre).toBe('Lindero Polilínea CAD');
    expect(resultado.poligonoPrincipal.origen).toBe('linestring');
    expect(resultado.advertencias.length).toBeGreaterThan(0);
  });

  it('rechaza un archivo KMZ sin KML o corrupto con mensaje claro', async () => {
    const zipSinKml = new JSZip();
    zipSinKml.file('readme.txt', 'sin kml');
    const bufferVacio = await zipSinKml.generateAsync({ type: 'uint8array' });

    await expect(procesarKMZ(bufferVacio)).rejects.toThrow(/KML/i);
    await expect(procesarKMZ(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow(
      /ZIP válido/i
    );
  });

  it('parsea un FeatureCollection GeoJSON válido y rechaza polígonos inválidos', () => {
    const geojson = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Polígono Santiago Demo' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-70.698, 19.451],
                [-70.697, 19.451],
                [-70.697, 19.452],
                [-70.698, 19.452],
                [-70.698, 19.451],
              ],
            ],
          },
        },
      ],
    });

    const poligono = parsearGeoJSON(geojson);
    expect(poligono.nombre).toBe('Polígono Santiago Demo');
    expect(poligono.formato).toBe('geojson');
    expect(poligono.provincia_sugerida).toBe('Santiago');

    expect(() => parsearGeoJSON('{"type":"Point","coordinates":[0,0]}')).toThrow();
  });
});
