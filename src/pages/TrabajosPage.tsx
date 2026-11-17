/**
 * Lista de trabajos con filtro por estado, búsqueda por cliente y creación para admin/coordinador.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  MapPin,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  ESTADOS_TRABAJO,
  ETIQUETAS_ESTADO_TRABAJO,
  formatearFechaCorta,
  obtenerFechaHoyISO,
} from '../domain/formatters';
import { puedeGestionarOperacion } from '../domain/operacion';
import type { EstadoTrabajo, Trabajo } from '../domain/types';
import { useAuth } from '../hooks/useAuth';
import { useOperacionData } from '../hooks/useOperacionData';

export const TrabajosPage: React.FC = () => {
  const { rolActivo } = useAuth();
  const { trabajos, personal, guardarTrabajo } = useOperacionData();
  const puedeCrear = puedeGestionarOperacion(rolActivo);

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoTrabajo | 'todos'>(
    'todos'
  );
  const [modalAbierto, setModalAbierto] = useState(false);

  // Estado del formulario de nuevo trabajo
  const [cliente, setCliente] = useState('');
  const [contacto, setContacto] = useState('');
  const [ubicacionTexto, setUbicacionTexto] = useState('');
  const [tipoLevantamiento, setTipoLevantamiento] = useState('Deslinde');
  const [fechaPrevista, setFechaPrevista] = useState(obtenerFechaHoyISO());
  const [estado, setEstado] = useState<EstadoTrabajo>('programado');
  const [responsableId, setResponsableId] = useState<string>('');
  const [guardando, setGuardando] = useState(false);

  const trabajosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return trabajos.filter((t) => {
      const coincideEstado =
        filtroEstado === 'todos' || t.estado === filtroEstado;
      const coincideCliente =
        !q ||
        t.cliente.toLowerCase().includes(q) ||
        t.ubicacion_texto.toLowerCase().includes(q) ||
        t.tipo_levantamiento.toLowerCase().includes(q);
      return coincideEstado && coincideCliente;
    });
  }, [trabajos, busqueda, filtroEstado]);

  const limpiarFormulario = () => {
    setCliente('');
    setContacto('');
    setUbicacionTexto('');
    setTipoLevantamiento('Deslinde');
    setFechaPrevista(obtenerFechaHoyISO());
    setEstado('programado');
    setResponsableId('');
  };

  const handleCrearTrabajo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente.trim() || !puedeCrear) return;

    setGuardando(true);
    try {
      await guardarTrabajo({
        cliente: cliente.trim(),
        contacto: contacto.trim(),
        ubicacion_texto: ubicacionTexto.trim(),
        lat: null,
        lng: null,
        tipo_levantamiento: tipoLevantamiento.trim() || 'Deslinde',
        fecha_prevista: fechaPrevista,
        fecha_inicio_real: null,
        fecha_fin_real: null,
        estado,
        responsable_id: responsableId || null,
      });

      limpiarFormulario();
      setModalAbierto(false);
    } catch {
      // El error queda visible en el banner de Layout
    } finally {
      setGuardando(false);
    }
  };

  const obtenerNombreResponsable = (id: string | null) => {
    if (!id) return 'Sin responsable';
    return personal.find((p) => p.id === id)?.nombre ?? 'Sin responsable';
  };

  return (
    <div className="space-y-5">
      {/* Encabezado y CTA principal */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Trabajos
          </h1>
          <p className="text-sm text-slate-600">
            {trabajosFiltrados.length} levantamiento(s) en operación
          </p>
        </div>

        {puedeCrear && (
          <button
            type="button"
            onClick={() => setModalAbierto(true)}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo trabajo</span>
          </button>
        )}
      </div>

      {/* Buscador por cliente */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por cliente, ubicación o tipo de levantamiento..."
          className="min-h-[46px] w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
        />
      </div>

      {/* Filtro interactivo por estado */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setFiltroEstado('todos')}
          className={`min-h-[40px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
            filtroEstado === 'todos'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          Todos ({trabajos.length})
        </button>
        {ESTADOS_TRABAJO.map((est) => {
          const cantidad = trabajos.filter((t) => t.estado === est).length;
          return (
            <button
              key={est}
              type="button"
              onClick={() => setFiltroEstado(est)}
              className={`min-h-[40px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                filtroEstado === est
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {ETIQUETAS_ESTADO_TRABAJO[est]} ({cantidad})
            </button>
          );
        })}
      </div>

      {/* Lista de trabajos */}
      <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {trabajosFiltrados.map((trabajo: Trabajo) => (
          <Link
            key={trabajo.id}
            to={`/trabajos/${trabajo.id}`}
            className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-slate-50"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h2 className="truncate text-base font-semibold text-slate-900">
                  {trabajo.cliente}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span className="font-semibold text-emerald-700">
                  {ETIQUETAS_ESTADO_TRABAJO[trabajo.estado]}
                </span>
                <span aria-hidden="true">·</span>
                <span>{trabajo.tipo_levantamiento}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {formatearFechaCorta(trabajo.fecha_prevista)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 truncate">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">
                    {trabajo.ubicacion_texto || 'Ubicación por definir'}
                  </span>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Resp.: {obtenerNombreResponsable(trabajo.responsable_id)}
                </span>
              </div>
            </div>

            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
          </Link>
        ))}

        {trabajosFiltrados.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            No se encontraron trabajos con los filtros actuales.
          </div>
        )}
      </div>

      {/* Modal para crear trabajo */}
      {modalAbierto && puedeCrear && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:max-w-lg sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                Nuevo levantamiento
              </h2>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCrearTrabajo} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Cliente *
                </label>
                <input
                  type="text"
                  required
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="Ej. Constructora Ejemplo SRL"
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Contacto
                  </label>
                  <input
                    type="text"
                    value={contacto}
                    onChange={(e) => setContacto(e.target.value)}
                    placeholder="809-555-0000"
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Fecha prevista *
                  </label>
                  <input
                    type="date"
                    required
                    value={fechaPrevista}
                    onChange={(e) => setFechaPrevista(e.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Ubicación (referencia)
                </label>
                <input
                  type="text"
                  value={ubicacionTexto}
                  onChange={(e) => setUbicacionTexto(e.target.value)}
                  placeholder="Municipio, sector, parcela..."
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Tipo de levantamiento
                  </label>
                  <input
                    type="text"
                    value={tipoLevantamiento}
                    onChange={(e) => setTipoLevantamiento(e.target.value)}
                    placeholder="Deslinde, replanteo, subdivisión..."
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Estado
                  </label>
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value as EstadoTrabajo)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-emerald-600 focus:outline-none"
                  >
                    {ESTADOS_TRABAJO.map((est) => (
                      <option key={est} value={est}>
                        {ETIQUETAS_ESTADO_TRABAJO[est]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Responsable
                </label>
                <select
                  value={responsableId}
                  onChange={(e) => setResponsableId(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-emerald-600 focus:outline-none"
                >
                  <option value="">Sin responsable asignado</option>
                  {personal
                    .filter((p) => p.activo)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="min-h-[44px] rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {guardando ? 'Guardando...' : 'Guardar trabajo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
