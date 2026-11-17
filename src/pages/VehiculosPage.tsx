/**
 * CRUD de vehículos de la empresa (tipo, combustible, rendimiento km/gal y estado).
 * El rol técnico solo visualiza la flota sin botones de crear, editar ni eliminar.
 */
import React, { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { EstadoVehiculoTexto } from '../components/ui/EstadoText';
import { ModalSheet } from '../components/ui/ModalSheet';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState, ListSkeleton } from '../components/ui/StateViews';
import { ETIQUETAS_ESTADO_VEHICULO } from '../domain/formatters';
import {
  puedeEliminarRegistros,
  puedeGestionarOperacion,
} from '../domain/operacion';
import type { EstadoVehiculo, Vehiculo } from '../domain/types';
import { useAuth } from '../hooks/useAuth';
import { useOperacionData } from '../hooks/useOperacionData';

const ESTADOS: EstadoVehiculo[] = ['disponible', 'en_uso', 'mantenimiento'];

export const VehiculosPage: React.FC = () => {
  const { rolActivo } = useAuth();
  const { vehiculos, cargandoDatos, guardarVehiculo, eliminarVehiculo } =
    useOperacionData();

  const puedeGestionar = puedeGestionarOperacion(rolActivo);
  const puedeEliminar = puedeEliminarRegistros(rolActivo);

  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | undefined>(undefined);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('Camioneta 4x4');
  const [combustible, setCombustible] = useState('Gasoil');
  const [rendimiento, setRendimiento] = useState('30');
  const [estado, setEstado] = useState<EstadoVehiculo>('disponible');
  const [guardando, setGuardando] = useState(false);

  const abrirNuevo = () => {
    if (!puedeGestionar) return;
    setEditandoId(undefined);
    setNombre('');
    setTipo('Camioneta 4x4');
    setCombustible('Gasoil');
    setRendimiento('30');
    setEstado('disponible');
    setModalAbierto(true);
  };

  const abrirEditar = (v: Vehiculo) => {
    if (!puedeGestionar) return;
    setEditandoId(v.id);
    setNombre(v.nombre);
    setTipo(v.tipo);
    setCombustible(v.combustible);
    setRendimiento(String(v.rendimiento_km_gal));
    setEstado(v.estado);
    setModalAbierto(true);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !puedeGestionar) return;
    setGuardando(true);
    try {
      await guardarVehiculo({
        id: editandoId,
        nombre: nombre.trim(),
        tipo: tipo.trim() || 'Camioneta 4x4',
        combustible: combustible.trim() || 'Gasoil',
        rendimiento_km_gal: Math.max(1, Number(rendimiento) || 30),
        estado,
      });
      setModalAbierto(false);
    } catch {
      // Error mostrado en banner
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id: string) => {
    if (!puedeEliminar) return;
    try {
      await eliminarVehiculo(id);
      setConfirmandoId(null);
    } catch {
      // El error queda visible en el banner de Layout
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vehículos"
        subtitle={`${vehiculos.filter((v) => v.estado === 'disponible').length} disponible(s) de ${vehiculos.length} en flota`}
        action={
          puedeGestionar ? (
            <button
              type="button"
              onClick={abrirNuevo}
              className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0 sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              <span>Agregar vehículo</span>
            </button>
          ) : undefined
        }
      />

      {cargandoDatos && vehiculos.length === 0 ? (
        <ListSkeleton rows={3} />
      ) : (
        <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {vehiculos.map((v) => (
            <div key={v.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <h2 className="truncate text-base font-semibold text-slate-900">
                    {v.nombre}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <EstadoVehiculoTexto estado={v.estado} />
                    <span aria-hidden="true">·</span>
                    <span>{v.tipo}</span>
                    <span aria-hidden="true">·</span>
                    <span>{v.combustible}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {v.rendimiento_km_gal} km/gal
                    </span>
                  </div>
                </div>

                {(puedeGestionar || puedeEliminar) && (
                  <div className="flex items-center gap-1 shrink-0">
                    {puedeGestionar && (
                      <button
                        type="button"
                        onClick={() => abrirEditar(v)}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        aria-label={`Editar ${v.nombre}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {puedeEliminar && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmandoId((actual) =>
                            actual === v.id ? null : v.id
                          )
                        }
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        aria-label={`Eliminar ${v.nombre}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {puedeEliminar && confirmandoId === v.id && (
                <div className="flex flex-col gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium">
                    ¿Eliminar el vehículo {v.nombre} de la flota?
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setConfirmandoId(null)}
                      className="min-h-[36px] rounded-lg border border-red-200 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleEliminar(v.id)}
                      className="min-h-[36px] rounded-lg bg-red-600 px-3 font-semibold text-white hover:bg-red-700"
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {vehiculos.length === 0 && (
            <EmptyState
              title="Sin vehículos registrados"
              description="Aún no hay vehículos registrados en esta empresa."
            />
          )}
        </div>
      )}

      <ModalSheet
        open={modalAbierto && puedeGestionar}
        title={editandoId ? 'Editar vehículo' : 'Nuevo vehículo'}
        onClose={() => setModalAbierto(false)}
        maxWidthClass="sm:max-w-md"
      >
        <form onSubmit={handleGuardar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Nombre o ficha *
            </label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Hilux 4x4 Blanca #01"
              className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Tipo
              </label>
              <input
                type="text"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                placeholder="Camioneta 4x4"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Combustible
              </label>
              <select
                value={combustible}
                onChange={(e) => setCombustible(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-emerald-600 focus:outline-none"
              >
                <option value="Gasoil">Gasoil</option>
                <option value="Gasolina Regular">Gasolina Regular</option>
                <option value="Gasolina Premium">Gasolina Premium</option>
                <option value="GLP">GLP</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Rendimiento (km/gal)
              </label>
              <input
                type="number"
                min="1"
                step="0.5"
                required
                value={rendimiento}
                onChange={(e) => setRendimiento(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 text-sm font-mono tabular-nums focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Estado
              </label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as EstadoVehiculo)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-emerald-600 focus:outline-none"
              >
                {ESTADOS.map((est) => (
                  <option key={est} value={est}>
                    {ETIQUETAS_ESTADO_VEHICULO[est]}
                  </option>
                ))}
              </select>
            </div>
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
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </ModalSheet>
    </div>
  );
};
