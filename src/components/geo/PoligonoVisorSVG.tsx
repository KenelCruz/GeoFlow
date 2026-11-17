/**
 * Visualizador vectorial interactivo (SVG offline) para archivos .KMZ, .KML y .GeoJSON.
 * - Muestra estado vacío privado idéntico al flujo esperado (sin polígonos de prueba pre-cargados).
 * - Proyecta los vértices del polígono sobre un lienzo técnico oscuro con selección de vértices,
 *   flecha norte, cuadro de rumbos y tabla de coordenadas.
 */
import React, { useMemo, useState } from 'react';
import { Compass, Crosshair, ListChecks, TableProperties, UploadCloud } from 'lucide-react';
import type { PoligonoParseado } from '../../domain/geo/types';

interface PoligonoVisorSVGProps {
  poligono: PoligonoParseado | null;
  onSolicitarArchivo: () => void;
}

const SVG_W = 640;
const SVG_H = 380;
const PADDING = 54;

export const PoligonoVisorSVG: React.FC<PoligonoVisorSVGProps> = ({
  poligono,
  onSolicitarArchivo,
}) => {
  const [verticeActivo, setVerticeActivo] = useState<number>(0);
  const [pestanaDetalle, setPestanaDetalle] = useState<'rumbos' | 'vertices'>(
    'rumbos'
  );

  const proyeccion = useMemo(() => {
    if (!poligono || poligono.vertices.length < 3) return null;

    const lats = poligono.vertices.map((v) => v.lat);
    const lngs = poligono.vertices.map((v) => v.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const cosLat = Math.cos((poligono.metricas.centroide.lat * Math.PI) / 180);
    const spanX = Math.max((maxLng - minLng) * cosLat, 1e-6);
    const spanY = Math.max(maxLat - minLat, 1e-6);

    const usableW = SVG_W - PADDING * 2;
    const usableH = SVG_H - PADDING * 2;
    const scale = Math.min(usableW / spanX, usableH / spanY);

    const offsetX = PADDING + (usableW - spanX * scale) / 2;
    const offsetY = PADDING + (usableH - spanY * scale) / 2;

    const puntos = poligono.vertices.map((v, idx) => {
      const x = offsetX + (v.lng - minLng) * cosLat * scale;
      const y = SVG_H - (offsetY + (v.lat - minLat) * scale);
      return {
        indice: idx,
        x,
        y,
        lat: v.lat,
        lng: v.lng,
      };
    });

    const cx =
      offsetX + (poligono.metricas.centroide.lng - minLng) * cosLat * scale;
    const cy =
      SVG_H - (offsetY + (poligono.metricas.centroide.lat - minLat) * scale);

    const pointsAttr = puntos
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');

    return { puntos, cx, cy, pointsAttr };
  }, [poligono]);

  if (!poligono || !proyeccion) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#081A2D] px-6 py-10 text-center text-white">
        {/* Cuadrícula sutil de plano topográfico */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(148,163,184,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.22) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="relative mx-auto flex max-w-md flex-col items-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/70 text-amber-400">
            <UploadCloud className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold tracking-tight text-white">
              Visualizador KMZ listo para su archivo
            </h3>
            <p className="text-xs leading-relaxed text-slate-300">
              Suba un archivo .KMZ, .KML o .GeoJSON en el panel izquierdo para
              desplegar el plano vectorial interactivo, inspeccionar sus vértices,
              ver el cuadro de rumbos y detectar la provincia automáticamente.
            </p>
          </div>
          <button
            type="button"
            onClick={onSolicitarArchivo}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-300"
          >
            <UploadCloud className="h-4 w-4" />
            <span>Subir archivo KMZ / KML</span>
          </button>
          <p className="font-mono text-[11px] text-slate-400">
            Sin polígonos de prueba pre-cargados · Procesamiento privado en su navegador.
          </p>
        </div>
      </div>
    );
  }

  const idxSeguro =
    verticeActivo < proyeccion.puntos.length ? verticeActivo : 0;
  const seleccionado = proyeccion.puntos[idxSeguro];
  const tramoSaliente = poligono.metricas.rumbos[idxSeguro];

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#081A2D] text-white">
        {/* Barra superior de lectura sobre el lienzo */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-950/60 px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Compass className="h-4 w-4 shrink-0 text-amber-400" />
            <span className="truncate font-semibold text-white">
              {poligono.nombre}
            </span>
            <span className="font-mono text-[11px] uppercase text-slate-400">
              ({poligono.formato})
            </span>
          </div>
          <span className="font-mono text-[11px] text-emerald-300 tabular-nums">
            {poligono.vertices.length} vértices · Centroide{' '}
            {poligono.metricas.centroide.lat.toFixed(5)},{' '}
            {poligono.metricas.centroide.lng.toFixed(5)}
          </span>
        </div>

        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="h-72 w-full select-none sm:h-80"
          role="img"
          aria-label={`Plano vectorial de ${poligono.nombre}`}
        >
          <defs>
            <pattern
              id="grid-blueprint"
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 32 0 L 0 0 0 32"
                fill="none"
                stroke="rgba(148,163,184,0.14)"
                strokeWidth="1"
              />
            </pattern>
          </defs>

          <rect width={SVG_W} height={SVG_H} fill="url(#grid-blueprint)" />

          {/* Brújula Norte */}
          <g transform={`translate(${SVG_W - 38}, 34)`}>
            <circle
              cx="0"
              cy="0"
              r="16"
              fill="rgba(15,23,42,0.75)"
              stroke="rgba(148,163,184,0.4)"
            />
            <polygon points="0,-11 4,3 0,0 -4,3" fill="#FBBF24" />
            <text
              x="0"
              y="12"
              textAnchor="middle"
              fill="#CBD5E1"
              fontSize="9"
              fontFamily="monospace"
            >
              N
            </text>
          </g>

          {/* Polígono principal */}
          <polygon
            points={proyeccion.pointsAttr}
            fill="rgba(16, 185, 129, 0.16)"
            stroke="#FBBF24"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Centroide */}
          <g transform={`translate(${proyeccion.cx}, ${proyeccion.cy})`}>
            <line x1="-7" y1="0" x2="7" y2="0" stroke="#34D399" strokeWidth="1.4" />
            <line x1="0" y1="-7" x2="0" y2="7" stroke="#34D399" strokeWidth="1.4" />
          </g>

          {/* Vértices numerados interactivos */}
          {proyeccion.puntos.map((p) => {
            const activo = p.indice === idxSeguro;
            return (
              <g
                key={p.indice}
                transform={`translate(${p.x}, ${p.y})`}
                onClick={() => setVerticeActivo(p.indice)}
                className="cursor-pointer"
              >
                <circle
                  r={activo ? 11 : 7}
                  fill={activo ? '#FBBF24' : '#0F172A'}
                  stroke={activo ? '#FFFFFF' : '#34D399'}
                  strokeWidth={activo ? 2 : 1.75}
                />
                <text
                  x="0"
                  y="-12"
                  textAnchor="middle"
                  fill={activo ? '#FDE68A' : '#E2E8F0'}
                  fontSize="10"
                  fontWeight="700"
                  fontFamily="monospace"
                >
                  V{p.indice + 1}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Barra de inspección del vértice y tramo seleccionado */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 bg-slate-950/75 px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2 font-mono tabular-nums text-slate-200">
            <Crosshair className="h-3.5 w-3.5 text-amber-400" />
            <span>
              V{seleccionado.indice + 1}: {seleccionado.lat.toFixed(6)},{' '}
              {seleccionado.lng.toFixed(6)}
            </span>
          </div>
          {tramoSaliente && (
            <div className="font-mono tabular-nums text-amber-300">
              Tramo V{tramoSaliente.desde}→V{tramoSaliente.hasta}:{' '}
              {tramoSaliente.rumbo_texto} ({tramoSaliente.distancia_m.toFixed(2)} m)
            </div>
          )}
        </div>
      </div>

      {/* Pestañas: Cuadro de Rumbos y Vértices */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPestanaDetalle('rumbos')}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
                pestanaDetalle === 'rumbos'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <TableProperties className="h-3.5 w-3.5" />
              <span>Cuadro de rumbos ({poligono.metricas.rumbos.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setPestanaDetalle('vertices')}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
                pestanaDetalle === 'vertices'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ListChecks className="h-3.5 w-3.5" />
              <span>Vértices ({poligono.vertices.length})</span>
            </button>
          </div>
          <span className="hidden text-[11px] text-slate-500 sm:inline">
            Visor SVG local (sin mapa satelital externo)
          </span>
        </div>

        <div className="max-h-56 overflow-x-auto overflow-y-auto">
          {pestanaDetalle === 'rumbos' ? (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-semibold">Tramo</th>
                  <th className="px-4 py-2 font-semibold">Rumbo</th>
                  <th className="px-4 py-2 font-semibold text-right">Azimut</th>
                  <th className="px-4 py-2 font-semibold text-right">
                    Distancia (m)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {poligono.metricas.rumbos.map((r) => (
                  <tr
                    key={`${r.desde}-${r.hasta}`}
                    onClick={() => setVerticeActivo(r.desde - 1)}
                    className={`cursor-pointer hover:bg-slate-50 ${
                      r.desde - 1 === idxSeguro ? 'bg-amber-50/70' : ''
                    }`}
                  >
                    <td className="px-4 py-2 font-semibold text-slate-900">
                      V{r.desde} → V{r.hasta}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{r.rumbo_texto}</td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      {r.azimut_grados.toFixed(2)}°
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-900">
                      {r.distancia_m.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-semibold">Vértice</th>
                  <th className="px-4 py-2 font-semibold text-right">Latitud</th>
                  <th className="px-4 py-2 font-semibold text-right">Longitud</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {poligono.vertices.map((v, idx) => (
                  <tr
                    key={idx}
                    onClick={() => setVerticeActivo(idx)}
                    className={`cursor-pointer hover:bg-slate-50 ${
                      idx === idxSeguro ? 'bg-amber-50/70' : ''
                    }`}
                  >
                    <td className="px-4 py-2 font-semibold text-slate-900">
                      V{idx + 1}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700">
                      {v.lat.toFixed(6)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700">
                      {v.lng.toFixed(6)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
