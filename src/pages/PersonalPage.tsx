/**
 * CRUD de personal de campo y oficina (técnico, ingeniero, jefe de brigada, chofer).
 * El rol técnico solo visualiza el directorio sin botones de crear, editar ni eliminar.
 */
import React, { useMemo, useState } from 'react';
import { Pencil, Phone, Plus, Search, Trash2 } from 'lucide-react';
import { ModalSheet } from '../components/ui/ModalSheet';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState, ListSkeleton } from '../components/ui/StateViews';
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
  const { personal, cargandoDatos, guardarPersonal, eliminarPersonal } =
    useOperacionData();

  const puedeGestionar = puedeGestionarOperacion(rolActivo);
  const puedeEliminar = puedeEliminarRegistros(rolActivo);

  const [busqueda, setBusqueda] = useState('');
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | undefined>(undefined);
  const [nombre, setNombre] = useState('');
  const [cargo, setCargo] = useState<CargoPersonal>('tecnico');
  const [telefono, setTelefono] = useState('');
  const [activo, setActivo] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const personalFiltrado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return personal;
    return personal.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        ETIQUETAS_CARGO[p.cargo].toLowerCase().includes(q)
    );
  }, [personal, busqueda]);

  const abrirNuevo = () => {
    if (!puedeGestionar) return;
    setEditandoId(undefined);
    setNombre('');
    setCargo('tecnico');
    setTelefono('');
    setActivo(true);
    setModalAbierto(true);
  };

  const abrirEditar = (p: Personal) => {
    if (!puedeGestionar) return;
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

  const handleEliminar = async (id: string) => {
    if (!puedeEliminar) return;
    try {
      await eliminarPersonal(id);
      setConfirmandoId(null);
    } catch {
      // El error queda visible en el banner de Layout
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Personal"
        subtitle={`${personal.filter((p) => p.activo).length} activo(s) de ${personal.length} registrado(s)`}
        action={
          puedeGestionar ? (
            <button
              type="button"
              onClick={abrirNuevo}
              className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0 sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              <span>Agregar personal</span>
            </button>
          ) : undefined
        }
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o cargo..."
          className="min-h-[46px] w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
        />
      </div>

      {cargandoDatos && personal.length === 0 ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {personalFiltrado.map((p) => (
            <div key={p.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <h2 className="truncate text-base font-semibold text-slate-900">
                    {p.nombre}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">
                      {ETIQUETAS_CARGO[p.cargo]}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        p.activo
                          ? 'font-semibold text-emerald-700'
                          : 'text-slate-400'
                      }
                    >
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                    {p.telefono && (
                      <>
                        <span aria-hidden="true">·</span>
                        <a
                          href={`tel:${p.telefono.replace(/\s+/g, '')}`}
                          className="inline-flex items-center gap-1 font-mono tabular-nums text-slate-600 hover:text-emerald-700"
                        >
                          <Phone className="h-3 w-3 text-slate-400" />
                          {p.telefono}
                        </a>
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
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        aria-label={`Editar ${p.nombre}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {puedeEliminar && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmandoId((actual) =>
                            actual === p.id ? null : p.id
                          )
                        }
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        aria-label={`Eliminar ${p.nombre}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {puedeEliminar && confirmandoId === p.id && (
                <div className="flex flex-col gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium">
                    ¿Eliminar a {p.nombre} de la empresa?
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
                      onClick={() => void handleEliminar(p.id)}
                      className="min-h-[36px] rounded-lg bg-red-600 px-3 font-semibold text-white hover:bg-red-700"
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {personalFiltrado.length === 0 && (
            <EmptyState
              title="Sin personal para mostrar"
              description={
                busqueda
                  ? 'No hay coincidencias con la búsqueda actual.'
                  : 'Aún no hay personal registrado en esta empresa.'
              }
            />
          )}
        </div>
      )}

      <ModalSheet
        open={modalAbierto && puedeGestionar}
        title={editandoId ? 'Editar personal' : 'Nuevo integrante'}
        onClose={() => setModalAbierto(false)}
        maxWidthClass="sm:max-w-md"
      >
        <form onSubmit={handleGuardar} className="space-y-4">
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
      </ModalSheet>
    </div>
  );
};
