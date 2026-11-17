/**
 * Agenda diaria y semanal de trabajos, personal y vehículos asignados.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Truck,
  Users,
} from 'lucide-react';
import {
  obtenerAgendaPorFecha,
  obtenerFechasSemana,
} from '../domain/conflictos';
import {
  ETIQUETAS_ESTADO_TRABAJO,
  formatearFechaCorta,
  obtenerFechaHoyISO,
} from '../domain/formatters';
import { useOperacionData } from '../hooks/useOperacionData';

function desplazarFecha(fechaISO: string, dias: number): string {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const f = new Date(y, m - 1, d + dias);
  const ay = f.getFullYear();
  const am = String(f.getMonth() + 1).padStart(2, '0');
  const ad = String(f.getDate()).padStart(2, '0');
  return `${ay}-${am}-${ad}`;
}

export const AgendaPage: React.FC = () => {
  const {
    trabajos,
    personal,
    vehiculos,
    asignacionesPersonal,
    asignacionesVehiculo,
  } = useOperacionData();

  const [vista, setVista] = useState<'semanal' | 'diaria'>('semanal');
  const [fechaBase, setFechaBase] = useState(obtenerFechaHoyISO());

  const fechasVisibles = useMemo(() => {
    if (vista === 'diaria') return [fechaBase];
    return obtenerFechasSemana(fechaBase);
  }, [vista, fechaBase]);

  const agendas = useMemo(
    () =>
      fechasVisibles.map((fecha) =>
        obtenerAgendaPorFecha({
          fecha,
          trabajos,
          personal,
          vehiculos,
          asignacionesPersonal,
          asignacionesVehiculo,
        })
      ),
    [
      fechasVisibles,
      trabajos,
      personal,
      vehiculos,
      asignacionesPersonal,
      asignacionesVehiculo,
    ]
  );

  const salto = vista === 'semanal' ? 7 : 1;

  return (
    <div className="space-y-5">
      {/* Encabezado y selector de vista */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Agenda operativa
          </h1>
          <p className="text-sm text-slate-600">
            Programación de trabajos, brigadas y vehículos
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-slate-200/70 p-1 self-start">
          <button
            type="button"
            onClick={() => setVista('diaria')}
            className={`min-h-[40px] rounded-lg px-4 text-xs font-semibold transition-colors whitespace-nowrap ${
              vista === 'diaria'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Diaria
          </button>
          <button
            type="button"
            onClick={() => setVista('semanal')}
            className={`min-h-[40px] rounded-lg px-4 text-xs font-semibold transition-colors whitespace-nowrap ${
              vista === 'semanal'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semanal
          </button>
        </div>
      </div>

      {/* Controles de navegación de fecha */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <button
          type="button"
          onClick={() => setFechaBase((f) => desplazarFecha(f, -salto))}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
          aria-label="Anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <input
            type="date"
            aria-label="Seleccionar fecha"
            value={fechaBase}
            onChange={(e) => setFechaBase(e.target.value)}
            className="min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm font-mono tabular-nums text-slate-900 focus:border-emerald-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setFechaBase(obtenerFechaHoyISO())}
            className="min-h-[42px] rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            Hoy
          </button>
        </div>

        <button
          type="button"
          onClick={() => setFechaBase((f) => desplazarFecha(f, salto))}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
          aria-label="Siguiente"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Días */}
      <div className="space-y-4">
        {agendas.map((dia) => {
          const esHoy = dia.fecha === obtenerFechaHoyISO();
          return (
            <section
              key={dia.fecha}
              className={`rounded-2xl border bg-white overflow-hidden ${
                esHoy ? 'border-emerald-500' : 'border-slate-200'
              }`}
            >
              <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold capitalize text-slate-900">
                    {formatearFechaCorta(dia.fecha)}
                  </h2>
                  {esHoy && (
                    <span className="text-xs font-semibold text-emerald-700">
                      · Hoy
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {dia.trabajos.length} trabajo(s)
                </span>
              </header>

              {dia.trabajos.length === 0 ? (
                <div className="px-4 py-4 text-xs text-slate-400">
                  Sin levantamientos programados.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {dia.trabajos.map(
                    ({ trabajo, personalAsignado, vehiculosAsignados }) => (
                      <li key={trabajo.id} className="p-4">
                        <Link
                          to={`/trabajos/${trabajo.id}`}
                          className="block space-y-2 hover:opacity-90"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-900">
                              {trabajo.cliente}
                            </span>
                            <span className="text-xs font-semibold text-emerald-700">
                              {ETIQUETAS_ESTADO_TRABAJO[trabajo.estado]}
                            </span>
                          </div>

                          <div className="text-xs text-slate-500">
                            {trabajo.tipo_levantamiento} ·{' '}
                            {trabajo.ubicacion_texto || 'Sin ubicación'}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-slate-400" />
                              {personalAsignado.length > 0
                                ? personalAsignado
                                    .map((p) => p.nombre)
                                    .join(', ')
                                : 'Sin personal'}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Truck className="h-3.5 w-3.5 text-slate-400" />
                              {vehiculosAsignados.length > 0
                                ? vehiculosAsignados
                                    .map((v) => v.nombre)
                                    .join(', ')
                                : 'Sin vehículo'}
                            </span>
                          </div>
                        </Link>
                      </li>
                    )
                  )}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};
