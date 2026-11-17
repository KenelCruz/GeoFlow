/**
 * Bitácora de campo por trabajo: nota, fecha/hora automáticas, foto desde cámara o galería,
 * subida a Supabase Storage y persistencia offline en IndexedDB.
 */
import React, { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  CloudOff,
  ImageOff,
  Send,
  X,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/StateViews';
import { formatearFechaHora } from '../domain/formatters';
import { useOperacionData } from '../hooks/useOperacionData';

export const BitacoraPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { trabajos, bitacora, agregarEntradaBitacora } = useOperacionData();

  const trabajo = trabajos.find((t) => t.id === id);
  const entradas = useMemo(
    () => bitacora.filter((b) => b.trabajo_id === id),
    [bitacora, id]
  );

  const [nota, setNota] = useState('');
  const [fotoArchivo, setFotoArchivo] = useState<File | null>(null);
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [imagenesConError, setImagenesConError] = useState<
    Record<string, boolean>
  >({});
  const inputFotoRef = useRef<HTMLInputElement | null>(null);

  const handleSeleccionarFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    setFotoArchivo(archivo);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFotoPreviewUrl(reader.result);
      }
    };
    reader.readAsDataURL(archivo);
  };

  const limpiarFoto = () => {
    setFotoArchivo(null);
    setFotoPreviewUrl(null);
    if (inputFotoRef.current) {
      inputFotoRef.current.value = '';
    }
  };

  const handleGuardarEntrada = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || (!nota.trim() && !fotoArchivo)) return;

    setGuardando(true);
    try {
      await agregarEntradaBitacora(
        id,
        nota.trim() || 'Registro fotográfico en campo',
        fotoArchivo
      );
      setNota('');
      limpiarFoto();
    } catch {
      // Error manejado por el contexto
    } finally {
      setGuardando(false);
    }
  };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={`/trabajos/${trabajo.id}`}
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver al trabajo</span>
        </Link>
      </div>

      <PageHeader
        title="Bitácora de campo"
        subtitle={`${trabajo.cliente} · ${trabajo.ubicacion_texto || 'Sin ubicación'}`}
      />

      {/* Formulario de nueva entrada (funciona sin conexión) */}
      <form
        onSubmit={handleGuardarEntrada}
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
      >
        <label
          htmlFor="nota-campo"
          className="block text-sm font-semibold text-slate-900"
        >
          Nueva nota de campo
        </label>
        <textarea
          id="nota-campo"
          rows={3}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ej. Se colocó estaca en vértice sur, buena recepción RTK..."
          className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
        />

        {fotoPreviewUrl && (
          <div className="relative inline-block">
            <img
              src={fotoPreviewUrl}
              alt="Vista previa de foto de campo"
              referrerPolicy="no-referrer"
              className="h-32 w-auto rounded-xl border border-slate-200 object-cover"
            />
            <button
              type="button"
              onClick={limpiarFoto}
              className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white shadow"
              aria-label="Quitar foto"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap">
            <Camera className="h-4 w-4 text-slate-500" />
            <span>Cámara o galería</span>
            <input
              ref={inputFotoRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleSeleccionarFoto}
              className="hidden"
            />
          </label>

          <button
            type="submit"
            disabled={guardando || (!nota.trim() && !fotoArchivo)}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-40 whitespace-nowrap"
          >
            <Send className="h-4 w-4" />
            <span>{guardando ? 'Guardando...' : 'Guardar nota'}</span>
          </button>
        </div>
      </form>

      {/* Historial cronológico */}
      <div className="space-y-3">
        {entradas.map((entrada) => {
          const imagenSrc =
            entrada.foto_preview_url ??
            (entrada.foto_url &&
            (entrada.foto_url.startsWith('data:') ||
              entrada.foto_url.startsWith('http'))
              ? entrada.foto_url
              : null);
          const falloImagen = Boolean(imagenesConError[entrada.id]);

          return (
            <article
              key={entrada.id}
              className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">
                    {entrada.autor_nombre || 'Técnico'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <time className="font-mono tabular-nums">
                    {formatearFechaHora(entrada.fecha_hora)}
                  </time>
                </div>

                {entrada.pendiente_sincronizar && (
                  <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                    <CloudOff className="h-3.5 w-3.5" />
                    <span>Pendiente de sincronizar</span>
                  </span>
                )}
              </div>

              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                {entrada.nota}
              </p>

              {imagenSrc && !falloImagen && (
                <img
                  src={imagenSrc}
                  alt="Evidencia fotográfica de campo"
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setImagenesConError((prev) => ({
                      ...prev,
                      [entrada.id]: true,
                    }))
                  }
                  className="max-h-72 w-full rounded-xl border border-slate-200 object-cover sm:w-auto"
                />
              )}

              {imagenSrc && falloImagen && (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
                  <ImageOff className="h-4 w-4 shrink-0 text-slate-400" />
                  <span>
                    No se pudo cargar la vista previa de la fotografía.
                  </span>
                </div>
              )}
            </article>
          );
        })}

        {entradas.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white">
            <EmptyState
              title="Sin entradas en la bitácora"
              description="Registra notas o fotografías de campo; funcionan incluso sin conexión."
            />
          </div>
        )}
      </div>
    </div>
  );
};
