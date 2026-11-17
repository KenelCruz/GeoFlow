/**
 * CRUD de vehículos de la empresa (tipo, combustible, rendimiento km/gal y estado).
 */
import React, { useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { ETIQUETAS_ESTADO_VEHICULO } from '../domain/formatters';
import type { EstadoVehiculo, Vehiculo } from '../domain/types';
import { useOperacionData } from '../hooks/useOperacionData';

const ESTADOS: EstadoVehiculo[] = ['disponible', 'en_uso', 'mantenimiento'];

export const VehiculosPage: React.FC = () => {
  const { vehiculos, guardarVehiculo, eliminarVehiculo } = useOperacionData();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | undefined>(undefined);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('Camioneta 4x4');
  const [combustible, setCombustible] = useState('Gasoil');
  const [rendimiento, setRendimiento] = useState('30');
  const [estado, setEstado] = useState<EstadoVehiculo>('disponible');

  const abrirNuevo = () => {
    setEditandoId(undefined);
    setNombre('');
    setTipo('Camioneta 4x4');
    setCombustible('Gasoil');
    setRendimiento('30');
    setEstado('disponible');
    setModalAbierto(true);
  };

  const abrirEditar = (v: Vehiculo) => {
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
    if (!nombre.trim()) return;
    await guardarVehiculo({
      id: editandoId,
      nombre: nombre.trim(),
      tipo: tipo.trim() || 'Camioneta 4x4',
      combustible: combustible.trim() || 'Gasoil',
      rendimiento_km_gal: Math.max(1, Number(rendimiento) || 30),
      estado,
    });
    setModalAbierto(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Vehículos
          </h1>
          <p className="text-sm text-slate-600">
            {vehiculos.filter((v) => v.estado === 'disponible').length}{' '}
            disponible(s) de {vehiculos.length} en flota
          </p>
        </div>

        <button
          type="button"
          onClick={abrirNuevo}
          className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Agregar vehículo</span>
        </button>
      </div>

      <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {vehiculos.map((v) => (
          <div
            key={v.id}
            className="flex items-center justify-between gap-4 p-4"
          >
            <div className="min-w-0 space-y-1">
              <h2 className="truncate text-base font-semibold text-slate-900">
                {v.nombre}
              </h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span
                  className={
                    v.estado === 'disponible'
                      ? 'font-semibold text-emerald-700'
                      : v.estado === 'mantenimiento'
                        ? 'font-semibold text-amber-700'
                        : 'font-semibold text-slate-700'
                  }
                >
                  {ETIQUETAS_ESTADO_VEHICULO[v.estado]}
                </span>
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

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => abrirEditar(v)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label={`Editar ${v.nombre}`}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => eliminarVehiculo(v.id)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"
                aria-label={`Eliminar ${v.nombre}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {vehiculos.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            Aún no hay vehículos registrados en esta empresa.
          </div>
        )}
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <div className="w-full rounded-t-3xl bg-white p-6 shadow-xl sm:max-w-md sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {editandoId ? 'Editar vehículo' : 'Nuevo vehículo'}
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

            <form onSubmit={handleGuardar} className="mt-4 space-y-4">
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
                    onChange={(e) =>
                      setEstado(e.target.value as EstadoVehiculo)
                    }
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
                  className="min-h-[44px] rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
