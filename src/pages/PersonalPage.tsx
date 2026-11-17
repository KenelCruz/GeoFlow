/**
 * CRUD de personal de campo y oficina (técnico, ingeniero, jefe de brigada, chofer).
 */
import React, { useState } from 'react';
import { Pencil, Phone, Plus, Trash2, X } from 'lucide-react';
import { ETIQUETAS_CARGO } from '../domain/formatters';
import {
  puedeEliminarRegistros,
  puedeGestionarOperacion,
} from '../domain/operacion';
import type { CargoPersonal, Personal } from '../domain/types';
import { useAuth } from '../hooks/useAuth';
import { useOperacionData } from '../hooks/useOperacionData';

const CARGOS: CargoPersonal[] = [
  'tecnico',
  'ingeniero',
  'jefe_brigada',
  'chofer',
];

export const PersonalPage: React.FC = () => {
  const { rolActivo } = useAuth();
  const { personal, guardarPersonal, eliminarPersonal } = useOperacionData();

  const puedeGestionar = puedeGestionarOperacion(rolActivo);
  const puedeEliminar = puedeEliminarRegistros(rolActivo);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | undefined>(undefined);
  const [nombre, setNombre] = useState('');
  const [cargo, setCargo] = useState<CargoPersonal>('tecnico');
  const [telefono, setTelefono] = useState('');
  const [activo, setActivo] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const abrirNuevo = () => {
    setEditandoId(undefined);
    setNombre('');
    setCargo('tecnico');
    setTelefono('');
    setActivo(true);
    setModalAbierto(true);
  };

  const abrirEditar = (p: Personal) => {
    setEditandoId(p.id);
    setNombre(p.nombre);
    setCargo(p.cargo);
    setTelefono(p.telefono);
    setActivo(p.activo);
    setModalAbierto(true);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !puedeGestionar) return;
    setGuardando(true);
    try {
      await guardarPersonal({
        id: editandoId,
        nombre: nombre.trim(),
        cargo,
        telefono: telefono.trim(),
        activo,
      });
      setModalAbierto(false);
    } catch {
      // Error mostrado en banner
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Personal
          </h1>
          <p className="text-sm text-slate-600">
            {personal.filter((p) => p.activo).length} activo(s) de{' '}
            {personal.length} registrado(s)
          </p>
        </div>

        {puedeGestionar && (
          <button
            type="button"
            onClick={abrirNuevo}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Agregar personal</span>
          </button>
        )}
      </div>

      <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {personal.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-4 p-4"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-base font-semibold text-slate-900">
                  {p.nombre}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span className="font-medium text-slate-700">
                  {ETIQUETAS_CARGO[p.cargo]}
                </span>
                <span aria-hidden="true">·</span>
                <span
                  className={
                    p.activo
                      ? 'font-medium text-emerald-700'
                      : 'text-slate-400'
                  }
                >
                  {p.activo ? 'Activo' : 'Inactivo'}
                </span>
                {p.telefono && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                      <Phone className="h-3 w-3 text-slate-400" />
                      {p.telefono}
                    </span>
                  </>
                )}
              </div>
            </div>

            {(puedeGestionar || puedeEliminar) && (
              <div className="flex items-center gap-1 shrink-0">
                {puedeGestionar && (
                  <button
                    type="button"
                    onClick={() => abrirEditar(p)}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    aria-label={`Editar ${p.nombre}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                {puedeEliminar && (
                  <button
                    type="button"
                    onClick={() => eliminarPersonal(p.id)}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Eliminar ${p.nombre}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {personal.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            Aún no hay personal registrado en esta empresa.
          </div>
        )}
      </div>

      {modalAbierto && puedeGestionar && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <div className="w-full rounded-t-3xl bg-white p-6 shadow-xl sm:max-w-md sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {editandoId ? 'Editar personal' : 'Nuevo integrante'}
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
                  Nombre completo *
                </label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Cargo
                </label>
                <select
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value as CargoPersonal)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-emerald-600 focus:outline-none"
                >
                  {CARGOS.map((c) => (
                    <option key={c} value={c}>
                      {ETIQUETAS_CARGO[c]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="809-555-0000"
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <label className="flex min-h-[44px] items-center gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={activo}
                  onChange={(e) => setActivo(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                />
                <span>Personal activo para asignaciones</span>
              </label>

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
          </div>
        </div>
      )}
    </div>
  );
};
