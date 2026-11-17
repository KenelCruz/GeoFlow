/**
 * Detalle de un trabajo: edición completa (admin/coordinador), cambio de estado en campo,
 * asignación de personal y vehículo por fecha con detección de conflictos y acceso a bitácora.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Calendar,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { ConflictoModal } from '../components/ConflictoModal';
import {
  detectarConflictosPersonal,
  detectarConflictosVehiculo,
} from '../domain/conflictos';
import {
  ESTADOS_TRABAJO,
  ETIQUETAS_CARGO,
  ETIQUETAS_ESTADO_TRABAJO,
  ETIQUETAS_ESTADO_VEHICULO,
  formatearFechaCorta,
} from '../domain/formatters';
import {
  obtenerAdvertenciaVehiculo,
  puedeActualizarEstadoCampo,
  puedeEliminarRegistros,
  puedeGestionarOperacion,
} from '../domain/operacion';
import type { ConflictoAgenda, EstadoTrabajo } from '../domain/types';
import { useAuth } from '../hooks/useAuth';
import { useOperacionData } from '../hooks/useOperacionData';

export const TrabajoDetallePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { rolActivo } = useAuth();

  const {
    trabajos,
    personal,
    vehiculos,
    asignacionesPersonal,
    asignacionesVehiculo,
    bitacora,
    guardarTrabajo,
    actualizarEstadoTrabajo,
    eliminarTrabajo,
    asignarPersonalATrabajo,
    quitarPersonalDeTrabajo,
    asignarVehiculoATrabajo,
    quitarVehiculoDeTrabajo,
  } = useOperacionData();

  const puedeGestionar = puedeGestionarOperacion(rolActivo);
  const puedeEliminar = puedeEliminarRegistros(rolActivo);
  const puedeCambiarEstado = puedeActualizarEstadoCampo(rolActivo);

  const trabajo = trabajos.find((t) => t.id === id);

  const [fechaAsignacion, setFechaAsignacion] = useState(
    trabajo?.fecha_prevista ?? ''
  );
  const [personalSeleccionado, setPersonalSeleccionado] = useState('');
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState('');

  // Modal de edición completa del trabajo
  const [editModalAbierto, setEditModalAbierto] = useState(false);
  const [editCliente, setEditCliente] = useState('');
  const [editContacto, setEditContacto] = useState('');
  const [editUbicacion, setEditUbicacion] = useState('');
  const [editTipo, setEditTipo] = useState('');
  const [editFechaPrevista, setEditFechaPrevista] = useState('');
  const [editResponsableId, setEditResponsableId] = useState('');
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  // Sincroniza fecha de asignación al cambiar de trabajo o terminar la carga inicial
  useEffect(() => {
    if (trabajo?.fecha_prevista) {
      setFechaAsignacion(trabajo.fecha_prevista);
    }
  }, [trabajo?.id, trabajo?.fecha_prevista]);

  // Estado para modal de conflictos
  const [conflictosPendientes, setConflictosPendientes] = useState<
    ConflictoAgenda[]
  >([]);
  const [accionConfirmada, setAccionConfirmada] = useState<
    (() => Promise<void>) | null
  >(null);

  const asignacionesPersTrabajo = useMemo(
    () => asignacionesPersonal.filter((a) => a.trabajo_id === id),
    [asignacionesPersonal, id]
  );

  const asignacionesVehTrabajo = useMemo(
    () => asignacionesVehiculo.filter((a) => a.trabajo_id === id),
    [asignacionesVehiculo, id]
  );

  const totalBitacora = useMemo(
    () => bitacora.filter((b) => b.trabajo_id === id).length,
    [bitacora, id]
  );

  const vehiculoActualSeleccionado = vehiculos.find(
    (v) => v.id === vehiculoSeleccionado
  );
  const advertenciaVehiculo = vehiculoActualSeleccionado
    ? obtenerAdvertenciaVehiculo(vehiculoActualSeleccionado)
    : null;

  if (!trabajo) {
    return (
      <div className="space-y-4">
        <Link
          to="/trabajos"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver a trabajos</span>
        </Link>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          No se encontró el trabajo solicitado.
        </div>
      </div>
    );
  }

  const fechaEfectiva = fechaAsignacion || trabajo.fecha_prevista;

  const abrirEdicion = () => {
    setEditCliente(trabajo.cliente);
    setEditContacto(trabajo.contacto);
    setEditUbicacion(trabajo.ubicacion_texto);
    setEditTipo(trabajo.tipo_levantamiento);
    setEditFechaPrevista(trabajo.fecha_prevista);
    setEditResponsableId(trabajo.responsable_id ?? '');
    setEditModalAbierto(true);
  };

  const handleGuardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCliente.trim() || !puedeGestionar) return;
    setGuardandoEdicion(true);
    try {
      await guardarTrabajo({
        ...trabajo,
        cliente: editCliente.trim(),
        contacto: editContacto.trim(),
        ubicacion_texto: editUbicacion.trim(),
        tipo_levantamiento: editTipo.trim() || 'Deslinde',
        fecha_prevista: editFechaPrevista,
        responsable_id: editResponsableId || null,
      });
      setEditModalAbierto(false);
    } catch {
      // El error queda visible en el banner de Layout
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const handleCambiarEstado = async (nuevoEstado: EstadoTrabajo) => {
    if (!puedeCambiarEstado) return;
    try {
      await actualizarEstadoTrabajo(trabajo.id, nuevoEstado);
    } catch {
      // El error queda visible en el banner de Layout
    }
  };

  const handleAsignarPersonal = async () => {
    if (!personalSeleccionado || !fechaEfectiva || !puedeGestionar) return;

    const conflictos = detectarConflictosPersonal({
      trabajoIdActual: trabajo.id,
      personalId: personalSeleccionado,
      fecha: fechaEfectiva,
      asignacionesExistentes: asignacionesPersonal,
      trabajos,
      personal,
    });

    const ejecutar = async () => {
      try {
        await asignarPersonalATrabajo(
          trabajo.id,
          personalSeleccionado,
          fechaEfectiva
        );
        setPersonalSeleccionado('');
      } catch {
        // Error mostrado en banner
      }
    };

    if (conflictos.length > 0) {
      setConflictosPendientes(conflictos);
      setAccionConfirmada(() => ejecutar);
      return;
    }

    await ejecutar();
  };

  const handleAsignarVehiculo = async () => {
    if (!vehiculoSeleccionado || !fechaEfectiva || !puedeGestionar) return;

    const conflictos = detectarConflictosVehiculo({
      trabajoIdActual: trabajo.id,
      vehiculoId: vehiculoSeleccionado,
      fecha: fechaEfectiva,
      asignacionesExistentes: asignacionesVehiculo,
      trabajos,
      vehiculos,
    });

    const ejecutar = async () => {
      try {
        await asignarVehiculoATrabajo(
          trabajo.id,
          vehiculoSeleccionado,
          fechaEfectiva
        );
        setVehiculoSeleccionado('');
      } catch {
        // Error mostrado en banner
      }
    };

    if (conflictos.length > 0) {
      setConflictosPendientes(conflictos);
      setAccionConfirmada(() => ejecutar);
      return;
    }

    await ejecutar();
  };

  const handleEliminar = async () => {
    if (!puedeEliminar) return;
    try {
      await eliminarTrabajo(trabajo.id);
      navigate('/trabajos');
    } catch {
      // Error mostrado en banner
    }
  };

  return (
    <div className="space-y-6">
      {/* Navegación superior */}
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/trabajos"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Trabajos</span>
        </Link>

        <Link
          to={`/trabajos/${trabajo.id}/bitacora`}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 whitespace-nowrap shrink-0"
        >
          <BookOpen className="h-4 w-4" />
          <span>Bitácora ({totalBitacora})</span>
        </Link>
      </div>

      {/* Información general */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold text-slate-900">
              {trabajo.cliente}
            </h1>
            <p className="text-sm font-medium text-slate-700">
              {trabajo.tipo_levantamiento}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {trabajo.ubicacion_texto || 'Sin ubicación'}
              </span>
              {trabajo.contacto && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {trabajo.contacto}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Prevista: {formatearFechaCorta(trabajo.fecha_prevista)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Estado del trabajo"
              disabled={!puedeCambiarEstado}
              value={trabajo.estado}
              onChange={(e) =>
                handleCambiarEstado(e.target.value as EstadoTrabajo)
              }
              className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none disabled:opacity-50"
            >
              {ESTADOS_TRABAJO.map((est) => (
                <option key={est} value={est}>
                  {ETIQUETAS_ESTADO_TRABAJO[est]}
                </option>
              ))}
            </select>

            {puedeGestionar && (
              <button
                type="button"
                onClick={abrirEdicion}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                aria-label="Editar trabajo"
                title="Editar trabajo"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}

            {puedeEliminar && (
              <button
                type="button"
                onClick={handleEliminar}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                aria-label="Eliminar trabajo"
                title="Eliminar trabajo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Selector de fecha para asignaciones */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Asignación de brigada y vehículos
            </h2>
            <p className="text-xs text-slate-500">
              El sistema verifica conflictos si un técnico o vehículo ya tiene
              otro trabajo ese día.
            </p>
          </div>
          {puedeGestionar && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="fecha-asig"
                className="text-xs font-medium text-slate-600 whitespace-nowrap"
              >
                Fecha:
              </label>
              <input
                id="fecha-asig"
                type="date"
                value={fechaEfectiva}
                onChange={(e) => setFechaAsignacion(e.target.value)}
                className="min-h-[42px] rounded-xl border border-slate-300 px-3 text-sm font-mono tabular-nums focus:border-emerald-600 focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Asignar Personal */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Users className="h-4 w-4 text-slate-500" />
              <span>Personal asignado</span>
            </div>

            {puedeGestionar && (
              <div className="flex gap-2">
                <select
                  value={personalSeleccionado}
                  onChange={(e) => setPersonalSeleccionado(e.target.value)}
                  className="min-h-[44px] flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-emerald-600 focus:outline-none"
                >
                  <option value="">Seleccionar técnico...</option>
                  {personal
                    .filter((p) => p.activo)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} ({ETIQUETAS_CARGO[p.cargo]})
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={handleAsignarPersonal}
                  disabled={!personalSeleccionado}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  <span>Asignar</span>
                </button>
              </div>
            )}

            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {asignacionesPersTrabajo.map((a) => {
                const persona = personal.find((p) => p.id === a.personal_id);
                return (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">
                        {persona?.nombre ?? 'Personal'}
                      </div>
                      <div className="text-xs text-slate-500 font-mono tabular-nums">
                        {formatearFechaCorta(a.fecha)}
                        {persona ? ` · ${ETIQUETAS_CARGO[persona.cargo]}` : ''}
                      </div>
                    </div>
                    {puedeGestionar && (
                      <button
                        type="button"
                        onClick={() => quitarPersonalDeTrabajo(a.id)}
                        className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Quitar personal"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}
              {asignacionesPersTrabajo.length === 0 && (
                <li className="p-4 text-center text-xs text-slate-500">
                  No hay personal asignado aún.
                </li>
              )}
            </ul>
          </div>

          {/* Asignar Vehículos */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Truck className="h-4 w-4 text-slate-500" />
              <span>Vehículos asignados</span>
            </div>

            {puedeGestionar && (
              <>
                <div className="flex gap-2">
                  <select
                    value={vehiculoSeleccionado}
                    onChange={(e) => setVehiculoSeleccionado(e.target.value)}
                    className="min-h-[44px] flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="">Seleccionar vehículo...</option>
                    {vehiculos.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nombre} ({ETIQUETAS_ESTADO_VEHICULO[v.estado]})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAsignarVehiculo}
                    disabled={!vehiculoSeleccionado}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Asignar</span>
                  </button>
                </div>

                {advertenciaVehiculo && (
                  <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
                    <span>{advertenciaVehiculo}</span>
                  </p>
                )}
              </>
            )}

            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {asignacionesVehTrabajo.map((a) => {
                const vehiculo = vehiculos.find((v) => v.id === a.vehiculo_id);
                return (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">
                        {vehiculo?.nombre ?? 'Vehículo'}
                      </div>
                      <div className="text-xs text-slate-500 font-mono tabular-nums">
                        {formatearFechaCorta(a.fecha)}
                        {vehiculo ? ` · ${vehiculo.tipo}` : ''}
                      </div>
                    </div>
                    {puedeGestionar && (
                      <button
                        type="button"
                        onClick={() => quitarVehiculoDeTrabajo(a.id)}
                        className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Quitar vehículo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}
              {asignacionesVehTrabajo.length === 0 && (
                <li className="p-4 text-center text-xs text-slate-500">
                  No hay vehículos asignados aún.
                </li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* Modal para editar trabajo existente */}
      {editModalAbierto && puedeGestionar && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:max-w-lg sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                Editar trabajo
              </h2>
              <button
                type="button"
                onClick={() => setEditModalAbierto(false)}
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarEdicion} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Cliente *
                </label>
                <input
                  type="text"
                  required
                  value={editCliente}
                  onChange={(e) => setEditCliente(e.target.value)}
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
                    value={editContacto}
                    onChange={(e) => setEditContacto(e.target.value)}
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
                    value={editFechaPrevista}
                    onChange={(e) => setEditFechaPrevista(e.target.value)}
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
                  value={editUbicacion}
                  onChange={(e) => setEditUbicacion(e.target.value)}
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
                    value={editTipo}
                    onChange={(e) => setEditTipo(e.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Responsable
                  </label>
                  <select
                    value={editResponsableId}
                    onChange={(e) => setEditResponsableId(e.target.value)}
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
              </div>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setEditModalAbierto(false)}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoEdicion}
                  className="min-h-[44px] rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConflictoModal
        conflictos={conflictosPendientes}
        onCancelar={() => {
          setConflictosPendientes([]);
          setAccionConfirmada(null);
        }}
        onConfirmar={async () => {
          if (accionConfirmada) {
            await accionConfirmada();
          }
          setConflictosPendientes([]);
          setAccionConfirmada(null);
        }}
      />
    </div>
  );
};
