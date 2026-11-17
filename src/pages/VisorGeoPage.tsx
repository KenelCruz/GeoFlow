/**
 * Módulo Geoespacial (KMZ/KML/GeoJSON) y Estimación de Viáticos / Levantamiento.
 * - Procesamiento 100% local en navegador (sin polígonos pre-cargados por privacidad).
 * - Parámetros comerciales inician en PENDIENTE_CONFIRMAR; no se inventan tarifas por defecto.
 * - Supuestos de unidades (m², tareas RD, ha) y proveedor de mapas marcados como pendientes.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Download,
  FileText,
  Printer,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { PoligonoVisorSVG } from '../components/geo/PoligonoVisorSVG';
import { ModalSheet } from '../components/ui/ModalSheet';
import { PageHeader } from '../components/ui/PageHeader';
import { formatearMonedaRD, obtenerFechaHoyISO } from '../domain/formatters';
import {
  calcularDistanciaDesdeSedeKm,
  EQUIVALENCIA_TAREA_RD_M2,
  PROVINCIAS_RD,
  SUPUESTOS_GEOESPACIAL,
} from '../domain/geo/calculos';
import { procesarArchivoKMZOGeo } from '../domain/geo/kmzService';
import type { PoligonoParseado } from '../domain/geo/types';
import { puedeGestionarOperacion } from '../domain/operacion';
import {
  calcularEstimacionViaticos,
  ETIQUETAS_SERVICIO,
  ETIQUETAS_TOPOGRAFIA,
} from '../domain/viaticos/parametros';
import type {
  ParametroViatico,
  TipoServicioLevantamiento,
  TopografiaTerreno,
} from '../domain/viaticos/types';
import { useAuth } from '../hooks/useAuth';
import { useGeoViaticos } from '../hooks/useGeoViaticos';
import { useOperacionData } from '../hooks/useOperacionData';

export const VisorGeoPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const trabajoIdQuery = searchParams.get('trabajoId') ?? '';

  const { empresaActiva, rolActivo } = useAuth();
  const { trabajos, guardarTrabajo } = useOperacionData();
  const {
    parametros,
    poligonosGuardados,
    guardando,
    errorGeo,
    limpiarErrorGeo,
    guardarParametros,
    guardarPoligonoTrabajo,
  } = useGeoViaticos();

  const puedeGestionar = puedeGestionarOperacion(rolActivo);
  const inputArchivoRef = useRef<HTMLInputElement | null>(null);

  // Estado de polígonos extraídos del KMZ y parámetros de entrada
  const [poligonosExtraidos, setPoligonosExtraidos] = useState<
    PoligonoParseado[]
  >([]);
  const [indicePoligonoActivo, setIndicePoligonoActivo] = useState<number>(0);
  const [advertenciasParsing, setAdvertenciasParsing] = useState<string[]>([]);
  const [modoManual, setModoManual] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);

  const poligono = poligonosExtraidos[indicePoligonoActivo] ?? null;

  const [servicio, setServicio] = useState<TipoServicioLevantamiento>('rtk');
  const [topografia, setTopografia] = useState<TopografiaTerreno>('llano');
  const [provincia, setProvincia] = useState<string>('Distrito Nacional');
  const [areaManualM2, setAreaManualM2] = useState<string>('2500');
  const [diasCampo, setDiasCampo] = useState<number>(1);
  const [cantidadTecnicos, setCantidadTecnicos] = useState<number>(2);
  const [incluirGabinete, setIncluirGabinete] = useState<boolean>(true);

  // Vinculación opcional a un trabajo existente
  const [trabajoSeleccionadoId, setTrabajoSeleccionadoId] =
    useState<string>(trabajoIdQuery);
  const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null);

  // Modal de configuración de tarifas (Parámetros de viáticos)
  const [modalTarifasAbierto, setModalTarifasAbierto] = useState(false);
  const [borradorTarifas, setBorradorTarifas] = useState<ParametroViatico[]>([]);

  // Modal para crear un trabajo en estado "cotizado" directo desde el KMZ
  const [modalCrearCotizacion, setModalCrearCotizacion] = useState(false);
  const [clienteNuevo, setClienteNuevo] = useState('');
  const [contactoNuevo, setContactoNuevo] = useState('');
  const [fechaPrevistaNueva, setFechaPrevistaNueva] = useState(
    obtenerFechaHoyISO()
  );
  const [creandoCotizacion, setCreandoCotizacion] = useState(false);

  useEffect(() => {
    if (trabajoIdQuery) {
      setTrabajoSeleccionadoId(trabajoIdQuery);
    }
  }, [trabajoIdQuery]);

  const provinciaObj = useMemo(
    () => PROVINCIAS_RD.find((p) => p.nombre === provincia) ?? PROVINCIAS_RD[0],
    [provincia]
  );

  const areaEfectivaM2 = poligono
    ? poligono.metricas.area_m2
    : Math.max(0, Number(areaManualM2) || 0);

  const tareasRD = Number((areaEfectivaM2 / EQUIVALENCIA_TAREA_RD_M2).toFixed(2));
  const hectareas = Number((areaEfectivaM2 / 10000).toFixed(4));

  const distanciaIdaKm = poligono
    ? poligono.distancia_desde_sede_km
    : calcularDistanciaDesdeSedeKm({
        lat: provinciaObj.lat,
        lng: provinciaObj.lng,
      });

  const estimacion = useMemo(
    () =>
      calcularEstimacionViaticos(
        {
          servicio,
          topografia,
          area_m2: areaEfectivaM2,
          distancia_ida_km: distanciaIdaKm,
          cantidad_tecnicos: cantidadTecnicos,
          dias_campo: diasCampo,
          incluir_gabinete: incluirGabinete,
        },
        parametros
      ),
    [
      areaEfectivaM2,
      cantidadTecnicos,
      diasCampo,
      distanciaIdaKm,
      incluirGabinete,
      parametros,
      servicio,
      topografia,
    ]
  );

  const procesarArchivo = async (archivo: File | null | undefined) => {
    if (!archivo) return;
    setErrorArchivo(null);
    setMensajeGuardado(null);
    try {
      const resultado = await procesarArchivoKMZOGeo(archivo);
      const idxPrincipal = Math.max(
        0,
        resultado.poligonos.indexOf(resultado.poligonoPrincipal)
      );
      setPoligonosExtraidos(resultado.poligonos);
      setIndicePoligonoActivo(idxPrincipal);
      setAdvertenciasParsing(resultado.advertencias);
      setModoManual(false);
      setProvincia(resultado.poligonoPrincipal.provincia_sugerida);
      setAreaManualM2(
        String(Math.round(resultado.poligonoPrincipal.metricas.area_m2))
      );
    } catch (err) {
      setErrorArchivo(
        err instanceof Error
          ? err.message
          : 'No se pudo procesar el archivo geoespacial.'
      );
    }
  };

  const seleccionarPoligonoExtraido = (nuevoIndice: number) => {
    const elegido = poligonosExtraidos[nuevoIndice];
    if (!elegido) return;
    setIndicePoligonoActivo(nuevoIndice);
    setProvincia(elegido.provincia_sugerida);
    setAreaManualM2(String(Math.round(elegido.metricas.area_m2)));
    setMensajeGuardado(null);
  };

  const abrirSelectorArchivo = () => {
    inputArchivoRef.current?.click();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastrando(false);
    const file = e.dataTransfer.files?.[0];
    await procesarArchivo(file);
  };

  const handleLimpiarPoligono = () => {
    setPoligonosExtraidos([]);
    setIndicePoligonoActivo(0);
    setAdvertenciasParsing([]);
    setErrorArchivo(null);
    setMensajeGuardado(null);
    if (inputArchivoRef.current) {
      inputArchivoRef.current.value = '';
    }
  };

  const handleExportarGeoJSON = () => {
    if (!poligono) return;
    const contenido = JSON.stringify(poligono.geojson, null, 2);
    const blob = new Blob([contenido], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    const base = poligono.nombre.replace(/\.[^.]+$/, '') || 'poligono';
    enlace.download = `${base}.geojson`;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
  };

  const handleGuardarEnTrabajo = async () => {
    if (!poligono || !puedeGestionar) return;
    setMensajeGuardado(null);
    limpiarErrorGeo();

    try {
      await guardarPoligonoTrabajo(poligono, trabajoSeleccionadoId || null);

      if (trabajoSeleccionadoId) {
        const trabajoDestino = trabajos.find(
          (t) => t.id === trabajoSeleccionadoId
        );
        if (trabajoDestino) {
          await guardarTrabajo({
            ...trabajoDestino,
            lat: Number(poligono.metricas.centroide.lat.toFixed(6)),
            lng: Number(poligono.metricas.centroide.lng.toFixed(6)),
          });
        }
      }

      setMensajeGuardado(
        trabajoSeleccionadoId
          ? 'Polígono y coordenadas de centroide guardados en el trabajo.'
          : 'Polígono guardado en el historial de la empresa.'
      );
    } catch {
      // El error queda visible en el banner de errorGeo
    }
  };

  const abrirModalTarifas = () => {
    setBorradorTarifas(parametros.map((p) => ({ ...p })));
    setModalTarifasAbierto(true);
  };

  const handleGuardarTarifas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeGestionar) return;

    const normalizados: ParametroViatico[] = borradorTarifas.map((item) => {
      const montoValido =
        item.monto_rd !== null &&
        Number.isFinite(item.monto_rd) &&
        item.monto_rd >= 0;
      const confirmado = item.estado === 'confirmada' && montoValido;
      return {
        ...item,
        monto_rd: confirmado ? item.monto_rd : null,
        estado: confirmado ? 'confirmada' : 'PENDIENTE_CONFIRMAR',
      };
    });

    try {
      await guardarParametros(normalizados);
      setModalTarifasAbierto(false);
    } catch {
      // Error mostrado en banner
    }
  };

  const handleCrearTrabajoCotizado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteNuevo.trim() || !puedeGestionar) return;
    setCreandoCotizacion(true);
    limpiarErrorGeo();

    try {
      const infoServicio = ETIQUETAS_SERVICIO[servicio];
      const ubicacionResumen = `${provincia} · ${Math.round(areaEfectivaM2).toLocaleString('es-DO')} m² (${tareasRD} tareas)`;
      const nuevoTrabajo = await guardarTrabajo({
        cliente: clienteNuevo.trim(),
        contacto: contactoNuevo.trim(),
        ubicacion_texto: ubicacionResumen,
        lat: poligono ? Number(poligono.metricas.centroide.lat.toFixed(6)) : null,
        lng: poligono ? Number(poligono.metricas.centroide.lng.toFixed(6)) : null,
        tipo_levantamiento: `${infoServicio.titulo} (${infoServicio.subtitulo})`,
        fecha_prevista: fechaPrevistaNueva,
        fecha_inicio_real: null,
        fecha_fin_real: null,
        estado: 'cotizado',
        responsable_id: null,
      });

      if (poligono) {
        await guardarPoligonoTrabajo(poligono, nuevoTrabajo.id);
      }

      setModalCrearCotizacion(false);
      navigate(`/trabajos/${nuevoTrabajo.id}`);
    } catch {
      // El error queda visible en el banner superior
    } finally {
      setCreandoCotizacion(false);
    }
  };

  const trabajoActivoObj = trabajos.find((t) => t.id === trabajoSeleccionadoId);
  const totalGuardadosTrabajo = trabajoSeleccionadoId
    ? poligonosGuardados.filter((p) => p.trabajo_id === trabajoSeleccionadoId)
        .length
    : poligonosGuardados.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cotizador y Visor KMZ"
        subtitle="Carga local de archivos .KMZ, .KML o .GeoJSON, cálculo de área/rumbos y estimación operativa."
        action={
          puedeGestionar ? (
            <button
              type="button"
              onClick={abrirModalTarifas}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap"
            >
              <Settings2 className="h-4 w-4 text-slate-600" />
              <span>Configurar tarifas</span>
            </button>
          ) : undefined
        }
      />

      {errorGeo && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900"
        >
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-700" />
            <span>{errorGeo}</span>
          </div>
          <button
            type="button"
            onClick={limpiarErrorGeo}
            className="font-semibold text-red-800 hover:underline whitespace-nowrap"
          >
            Ocultar
          </button>
        </div>
      )}

      {/* Layout de dos columnas inspirado en la referencia */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Columna izquierda: Carga de polígono + parámetros de servicio */}
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Cargar Polígono KMZ
            </h2>
            <span className="font-mono text-xs font-medium text-sky-700">
              Detección Auto
            </span>
          </div>

          <input
            ref={inputArchivoRef}
            type="file"
            accept=".kmz,.kml,.geojson,.json"
            className="hidden"
            onChange={(e) => void procesarArchivo(e.target.files?.[0])}
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setArrastrando(true);
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => void handleDrop(e)}
            onClick={abrirSelectorArchivo}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') abrirSelectorArchivo();
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
              arrastrando
                ? 'border-sky-600 bg-sky-50'
                : 'border-sky-300/80 bg-slate-50/60 hover:border-sky-500 hover:bg-sky-50/40'
            }`}
          >
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-700">
              <UploadCloud className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-slate-900">
              Arrastre su archivo .KMZ, .KML o .GeoJSON
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              o haga clic para explorar en su equipo
            </p>
          </div>

          {errorArchivo && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorArchivo}</span>
            </div>
          )}

          {poligono ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-emerald-950">
                    {poligono.nombre}
                  </p>
                  <p className="font-mono text-emerald-800 tabular-nums">
                    {poligono.vertices.length} vértices ·{' '}
                    {poligono.metricas.perimetro_m.toLocaleString('es-DO')} m perímetro
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLimpiarPoligono}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-50 shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Quitar</span>
                </button>
              </div>

              {poligonosExtraidos.length > 1 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5">
                  <label
                    htmlFor="geo-lote-select"
                    className="block text-[11px] font-bold uppercase tracking-wide text-slate-600"
                  >
                    Polígonos extraídos ({poligonosExtraidos.length} parcelas)
                  </label>
                  <select
                    id="geo-lote-select"
                    value={indicePoligonoActivo}
                    onChange={(e) =>
                      seleccionarPoligonoExtraido(Number(e.target.value))
                    }
                    className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
                  >
                    {poligonosExtraidos.map((item, idx) => (
                      <option key={`${item.nombre}-${idx}`} value={idx}>
                        {item.nombre} —{' '}
                        {Math.round(item.metricas.area_m2).toLocaleString('es-DO')}{' '}
                        m² ({item.metricas.area_tareas_rd} tareas)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {advertenciasParsing.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {advertenciasParsing.join(' ')}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setModoManual((v) => !v)}
              className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                modoManual
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              <FileText
                className={`h-4 w-4 shrink-0 ${
                  modoManual ? 'text-amber-300' : 'text-slate-500'
                }`}
              />
              <div className="min-w-0">
                <div className="text-xs font-semibold">
                  Estimación manual (sin polígono cargado)
                </div>
                <div
                  className={`text-[11px] ${
                    modoManual ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  Cálculo por superficie ingresada
                </div>
              </div>
            </button>
          )}

          <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs leading-relaxed text-slate-600">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
            <span>
              Por privacidad de nuestros clientes no publicamos ni precargamos
              polígonos de prueba. Su archivo .KMZ/.KML se procesa localmente en
              su navegador y el visualizador se despliega al cargarlo.
            </span>
          </div>

          {/* Tipo de Levantamiento / Servicio */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-700">
              Tipo de Levantamiento / Servicio
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              {(
                Object.keys(ETIQUETAS_SERVICIO) as TipoServicioLevantamiento[]
              ).map((clave) => {
                const activo = servicio === clave;
                const info = ETIQUETAS_SERVICIO[clave];
                return (
                  <button
                    key={clave}
                    type="button"
                    onClick={() => setServicio(clave)}
                    className={`min-h-[56px] rounded-xl border px-2.5 py-2 text-left transition-colors ${
                      activo
                        ? 'border-slate-900 bg-[#081A2D] text-white'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold leading-tight">
                      {info.titulo}
                    </div>
                    <div
                      className={`mt-0.5 text-[11px] leading-tight ${
                        activo ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {info.subtitulo}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Topografía de Terreno */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-700">
              Topografía de Terreno
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ETIQUETAS_TOPOGRAFIA) as TopografiaTerreno[]).map(
                (topo) => {
                  const activo = topografia === topo;
                  return (
                    <button
                      key={topo}
                      type="button"
                      onClick={() => setTopografia(topo)}
                      className={`min-h-[44px] rounded-xl border px-2 text-xs font-semibold transition-colors ${
                        activo
                          ? 'border-sky-700 bg-sky-700 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {ETIQUETAS_TOPOGRAFIA[topo]}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Provincia y Área manual */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="geo-provincia"
                className="block text-xs font-semibold text-slate-700"
              >
                Provincia
              </label>
              <select
                id="geo-provincia"
                value={provincia}
                onChange={(e) => setProvincia(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-emerald-600 focus:outline-none"
              >
                {PROVINCIAS_RD.map((p) => (
                  <option key={p.nombre} value={p.nombre}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="geo-area"
                className="block text-xs font-semibold text-slate-700"
              >
                Área (m²)
              </label>
              <input
                id="geo-area"
                type="number"
                min="0"
                step="1"
                disabled={Boolean(poligono)}
                value={
                  poligono
                    ? Math.round(poligono.metricas.area_m2)
                    : areaManualM2
                }
                onChange={(e) => setAreaManualM2(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm font-mono tabular-nums focus:border-emerald-600 focus:outline-none disabled:bg-slate-100 disabled:text-slate-600"
              />
            </div>
          </div>

          {/* Parámetros de jornada y brigada */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="geo-dias"
                className="block text-xs font-semibold text-slate-700"
              >
                Días en campo
              </label>
              <input
                id="geo-dias"
                type="number"
                min="1"
                max="60"
                value={diasCampo}
                onChange={(e) =>
                  setDiasCampo(Math.max(1, Number(e.target.value) || 1))
                }
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm font-mono tabular-nums focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="geo-tecnicos"
                className="block text-xs font-semibold text-slate-700"
              >
                Técnicos
              </label>
              <input
                id="geo-tecnicos"
                type="number"
                min="1"
                max="15"
                value={cantidadTecnicos}
                onChange={(e) =>
                  setCantidadTecnicos(Math.max(1, Number(e.target.value) || 1))
                }
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm font-mono tabular-nums focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <label className="flex min-h-[40px] cursor-pointer items-center gap-2.5 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={incluirGabinete}
              onChange={(e) => setIncluirGabinete(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600"
            />
            <span>Incluir gabinete CAD y entrega de planos</span>
          </label>

          {/* Vincular polígono a un trabajo existente (solo admin/coordinador) */}
          {puedeGestionar && poligono && (
            <div className="space-y-2 border-t border-slate-200 pt-4">
              <label
                htmlFor="geo-trabajo"
                className="block text-xs font-semibold text-slate-700"
              >
                Asociar coordenadas a un trabajo (opcional)
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  id="geo-trabajo"
                  value={trabajoSeleccionadoId}
                  onChange={(e) => setTrabajoSeleccionadoId(e.target.value)}
                  className="min-h-[44px] flex-1 rounded-xl border border-slate-300 bg-white px-3 text-xs focus:border-emerald-600 focus:outline-none"
                >
                  <option value="">Solo guardar en historial de empresa</option>
                  {trabajos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.cliente} · {t.ubicacion_texto || t.tipo_levantamiento}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => void handleGuardarEnTrabajo()}
                  className="min-h-[44px] rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {guardando ? 'Guardando...' : 'Guardar polígono'}
                </button>
              </div>
              {mensajeGuardado && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{mensajeGuardado}</span>
                </p>
              )}
            </div>
          )}
        </section>

        {/* Columna derecha: Estimación + Visualizador SVG + Desglose */}
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                Estimación de Levantamiento
              </h2>
              {trabajoActivoObj && (
                <p className="text-xs text-slate-500">
                  Trabajo: {trabajoActivoObj.cliente}
                </p>
              )}
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {empresaActiva?.nombre ?? 'Empresa'} · {totalGuardadosTrabajo}{' '}
              polígono(s)
            </span>
          </div>

          {/* Banda KPI de 3 columnas */}
          <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 sm:grid-cols-3">
            <div className="border-b border-slate-200 p-4 sm:border-b-0 sm:border-r">
              <p className="text-xs font-medium text-slate-500">Área Neta</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
                {areaEfectivaM2.toLocaleString('es-DO', {
                  maximumFractionDigits: 1,
                })}{' '}
                m²
              </p>
              <p className="mt-0.5 text-xs text-sky-700 font-mono tabular-nums">
                ≈ {tareasRD.toLocaleString('es-DO')} tareas ({hectareas} ha)
              </p>
            </div>

            <div className="border-b border-slate-200 p-4 sm:border-b-0 sm:border-r">
              <p className="text-xs font-medium text-slate-500">
                Distancia Logística
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
                {distanciaIdaKm.toFixed(1)} km
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {poligono
                  ? `Perímetro ${poligono.metricas.perimetro_m.toLocaleString('es-DO')} m`
                  : `Desde Sto. Dgo. (${provincia}) · Supuesto`}
              </p>
            </div>

            <div className="bg-[#081A2D] p-4 text-white">
              <p className="text-xs font-medium text-slate-300">
                Inversión Estimada
              </p>
              {estimacion.total_rd !== null ? (
                <>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-amber-400 font-mono tabular-nums">
                    {formatearMonedaRD(estimacion.total_rd)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-300">
                    Tarifas confirmadas por la empresa
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-base font-bold tracking-tight text-amber-300 font-mono">
                    PENDIENTE_CONFIRMAR
                  </p>
                  <p className="mt-1 text-[11px] text-slate-300">
                    Faltan {estimacion.parametros_pendientes.length} tarifa(s)
                    por confirmar
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Visualizador SVG KMZ/KML/GeoJSON */}
          <PoligonoVisorSVG
            poligono={poligono}
            onSolicitarArchivo={abrirSelectorArchivo}
          />

          {/* Desglose de Viáticos y Brigada */}
          <div className="space-y-2 border-t border-slate-200 pt-4">
            {estimacion.lineas.map((linea) => (
              <div
                key={linea.codigo + linea.concepto}
                className="flex items-start justify-between gap-4 py-1 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">{linea.concepto}</p>
                  <p className="text-xs text-slate-500">{linea.detalle}</p>
                </div>
                <span
                  className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${
                    linea.monto_rd === null
                      ? 'text-amber-700'
                      : 'text-slate-900'
                  }`}
                >
                  {linea.monto_rd !== null
                    ? formatearMonedaRD(linea.monto_rd)
                    : 'PENDIENTE_CONFIRMAR'}
                </span>
              </div>
            ))}

            <div className="flex items-center justify-between border-t border-slate-200 pt-3">
              <span className="text-sm font-bold text-slate-900">
                Total Estimado:
              </span>
              <span
                className={`font-mono text-lg font-bold tabular-nums ${
                  estimacion.total_rd === null
                    ? 'text-amber-700'
                    : 'text-sky-900'
                }`}
              >
                {estimacion.total_rd !== null
                  ? formatearMonedaRD(estimacion.total_rd)
                  : 'PENDIENTE_CONFIRMAR'}
              </span>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex flex-col flex-wrap gap-2.5 sm:flex-row">
            {puedeGestionar && (
              <button
                type="button"
                onClick={() => {
                  setClienteNuevo(
                    poligono ? poligono.nombre.replace(/\.[^.]+$/, '') : ''
                  );
                  setModalCrearCotizacion(true);
                }}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-300 whitespace-nowrap"
              >
                <Briefcase className="h-4 w-4" />
                <span>Crear trabajo cotizado</span>
              </button>
            )}

            {puedeGestionar && (
              <button
                type="button"
                onClick={abrirModalTarifas}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span>
                  {estimacion.estado_total === 'PENDIENTE_CONFIRMAR'
                    ? 'Confirmar tarifas'
                    : 'Tarifas'}
                </span>
              </button>
            )}

            {poligono && (
              <button
                type="button"
                onClick={handleExportarGeoJSON}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap"
              >
                <Download className="h-4 w-4" />
                <span>GeoJSON</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir</span>
            </button>
          </div>
        </section>
      </div>

      {/* Supuestos pendientes transparentes */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">
            Supuestos pendientes por confirmar (Geoespacial y Viáticos)
          </h3>
          <span className="font-mono text-xs text-amber-700 font-semibold">
            SUPUESTO_PENDIENTE
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {SUPUESTOS_GEOESPACIAL.map((s) => (
            <div
              key={s.clave}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs space-y-1"
            >
              <p className="font-semibold text-slate-900">{s.titulo}</p>
              <p className="leading-relaxed text-slate-600">
                {s.opcion_propuesta}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Modal de configuración de tarifas (solo admin/coordinador) */}
      <ModalSheet
        open={modalTarifasAbierto && puedeGestionar}
        title="Tabla de parámetros de viáticos y brigada"
        maxWidthClass="sm:max-w-2xl"
        onClose={() => setModalTarifasAbierto(false)}
      >
        <form onSubmit={(e) => void handleGuardarTarifas(e)} className="space-y-4">
          <p className="text-xs leading-relaxed text-slate-600">
            Define los montos oficiales de tu empresa en pesos dominicanos (RD$).
            Los conceptos sin monto confirmado permanecen en{' '}
            <span className="font-mono font-semibold text-amber-700">
              PENDIENTE_CONFIRMAR
            </span>
            .
          </p>

          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            {borradorTarifas.map((param, idx) => (
              <div
                key={param.codigo}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900">
                    {param.concepto}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500">
                    {param.unidad}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Sin monto"
                    aria-label={`Monto para ${param.concepto}`}
                    value={param.monto_rd ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const num = val === '' ? null : Number(val);
                      setBorradorTarifas((prev) =>
                        prev.map((item, i) =>
                          i === idx
                            ? {
                                ...item,
                                monto_rd: num,
                                estado:
                                  num !== null && Number.isFinite(num)
                                    ? 'confirmada'
                                    : 'PENDIENTE_CONFIRMAR',
                              }
                            : item
                        )
                      );
                    }}
                    className="min-h-[40px] w-32 rounded-lg border border-slate-300 px-3 text-sm font-mono tabular-nums focus:border-emerald-600 focus:outline-none"
                  />
                  <select
                    aria-label={`Estado para ${param.concepto}`}
                    value={param.estado}
                    onChange={(e) => {
                      const est = e.target.value as ParametroViatico['estado'];
                      setBorradorTarifas((prev) =>
                        prev.map((item, i) =>
                          i === idx
                            ? {
                                ...item,
                                estado: est,
                                monto_rd:
                                  est === 'PENDIENTE_CONFIRMAR'
                                    ? null
                                    : item.monto_rd,
                              }
                            : item
                        )
                      );
                    }}
                    className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800 focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="PENDIENTE_CONFIRMAR">
                      PENDIENTE_CONFIRMAR
                    </option>
                    <option value="confirmada">Confirmada</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setModalTarifasAbierto(false)}
              className="min-h-[44px] rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="min-h-[44px] rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Guardar tarifas'}
            </button>
          </div>
        </form>
      </ModalSheet>

      {/* Modal para registrar la estimación como un trabajo en estado cotizado */}
      <ModalSheet
        open={modalCrearCotizacion && puedeGestionar}
        title="Crear trabajo cotizado desde KMZ"
        onClose={() => setModalCrearCotizacion(false)}
      >
        <form
          onSubmit={(e) => void handleCrearTrabajoCotizado(e)}
          className="space-y-4"
        >
          <p className="text-xs leading-relaxed text-slate-600">
            Se creará un trabajo en estado{' '}
            <span className="font-semibold text-slate-900">Cotizado</span> con
            la provincia, superficie ({Math.round(areaEfectivaM2).toLocaleString('es-DO')} m²)
            {poligono ? ' y el polígono KMZ adjunto' : ''}.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Cliente *
            </label>
            <input
              type="text"
              required
              value={clienteNuevo}
              onChange={(e) => setClienteNuevo(e.target.value)}
              placeholder="Ej. Inversiones del Este SRL"
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
                value={contactoNuevo}
                onChange={(e) => setContactoNuevo(e.target.value)}
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
                value={fechaPrevistaNueva}
                onChange={(e) => setFechaPrevistaNueva(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setModalCrearCotizacion(false)}
              className="min-h-[44px] rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creandoCotizacion}
              className="min-h-[44px] rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {creandoCotizacion ? 'Creando...' : 'Crear cotización'}
            </button>
          </div>
        </form>
      </ModalSheet>
    </div>
  );
};
