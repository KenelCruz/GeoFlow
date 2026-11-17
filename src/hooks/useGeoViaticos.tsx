/**
 * Hook de acceso a datos para parámetros de viáticos y polígonos por empresa.
 * Mantiene los componentes desacoplados de Supabase y respeta multi-tenant + estados PENDIENTE_CONFIRMAR.
 */
import { useCallback, useEffect, useState } from 'react';
import type { PoligonoParseado } from '../domain/geo/types';
import { PARAMETROS_VIATICOS_INICIALES } from '../domain/viaticos/parametros';
import type { ParametroViatico } from '../domain/viaticos/types';
import {
  isDemoModeAllowed,
  isSupabaseConfigured,
  supabase,
} from '../lib/supabase';
import { useAuth } from './useAuth';
import { useOnlineStatus } from './useOnlineStatus';

export interface PoligonoTrabajoGuardado {
  id: string;
  empresa_id: string;
  trabajo_id: string | null;
  nombre_archivo: string;
  formato: PoligonoParseado['formato'];
  geojson: PoligonoParseado['geojson'];
  area_m2: number;
  perimetro_m: number;
  centroide_lat: number;
  centroide_lng: number;
  provincia_detectada: string;
  creado_en: string;
}

const KEY_PARAMS = (empresaId: string) =>
  `geoflow_parametros_viaticos_${empresaId}`;
const KEY_POLIGONOS = (empresaId: string) =>
  `geoflow_poligonos_trabajo_${empresaId}`;

function combinarConIniciales(
  filas: Array<{
    codigo: string;
    concepto?: string;
    unidad?: string;
    monto_rd: number | string | null;
    estado: string;
  }>
): ParametroViatico[] {
  const mapa = new Map(filas.map((f) => [f.codigo, f]));
  return PARAMETROS_VIATICOS_INICIALES.map((base) => {
    const remoto = mapa.get(base.codigo);
    if (!remoto) return base;
    const monto =
      remoto.monto_rd === null || remoto.monto_rd === undefined
        ? null
        : Number(remoto.monto_rd);
    const confirmado =
      remoto.estado === 'confirmada' && monto !== null && Number.isFinite(monto);
    return {
      codigo: base.codigo,
      concepto: remoto.concepto || base.concepto,
      unidad: remoto.unidad || base.unidad,
      monto_rd: confirmado ? monto : null,
      estado: confirmado ? 'confirmada' : 'PENDIENTE_CONFIRMAR',
    };
  });
}

export function useGeoViaticos() {
  const { empresaActiva, usuario } = useAuth();
  const isOnline = useOnlineStatus();
  const empresaId = empresaActiva?.id ?? null;

  const [parametros, setParametros] = useState<ParametroViatico[]>(
    PARAMETROS_VIATICOS_INICIALES
  );
  const [poligonosGuardados, setPoligonosGuardados] = useState<
    PoligonoTrabajoGuardado[]
  >([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGeo, setErrorGeo] = useState<string | null>(null);

  useEffect(() => {
    if (!empresaId) {
      setParametros(PARAMETROS_VIATICOS_INICIALES);
      setPoligonosGuardados([]);
      return;
    }

    let activo = true;

    const cargar = async () => {
      setCargando(true);
      setErrorGeo(null);

      if (isSupabaseConfigured && supabase) {
        if (!isOnline) {
          try {
            const raw = localStorage.getItem(KEY_PARAMS(empresaId));
            if (raw && activo) {
              setParametros(combinarConIniciales(JSON.parse(raw)));
            }
          } catch {
            // Mantener parámetros iniciales PENDIENTE_CONFIRMAR
          }
          if (activo) setCargando(false);
          return;
        }

        const [resParams, resPolis] = await Promise.all([
          supabase
            .from('parametros_viaticos')
            .select('codigo, concepto, unidad, monto_rd, estado')
            .eq('empresa_id', empresaId),
          supabase
            .from('poligonos_trabajo')
            .select('*')
            .eq('empresa_id', empresaId)
            .order('creado_en', { ascending: false }),
        ]);

        if (!activo) return;

        if (resParams.error) {
          setErrorGeo(
            `No se pudieron cargar las tarifas de viáticos: ${resParams.error.message}`
          );
          setCargando(false);
          return;
        }

        const listaParams = combinarConIniciales(resParams.data ?? []);
        setParametros(listaParams);
        try {
          localStorage.setItem(KEY_PARAMS(empresaId), JSON.stringify(listaParams));
        } catch {
          // Ignorar error de cuota
        }

        if (resPolis.error) {
          setErrorGeo(
            `No se pudieron cargar los polígonos guardados: ${resPolis.error.message}`
          );
        } else {
          setPoligonosGuardados(
            (resPolis.data as PoligonoTrabajoGuardado[]) ?? []
          );
        }

        setCargando(false);
        return;
      }

      if (isDemoModeAllowed) {
        try {
          const rawParams = localStorage.getItem(KEY_PARAMS(empresaId));
          const rawPolis = localStorage.getItem(KEY_POLIGONOS(empresaId));
          if (activo) {
            setParametros(
              rawParams
                ? combinarConIniciales(JSON.parse(rawParams))
                : PARAMETROS_VIATICOS_INICIALES
            );
            setPoligonosGuardados(rawPolis ? JSON.parse(rawPolis) : []);
          }
        } catch {
          if (activo) {
            setParametros(PARAMETROS_VIATICOS_INICIALES);
            setPoligonosGuardados([]);
          }
        }
      }

      if (activo) setCargando(false);
    };

    void cargar();
    return () => {
      activo = false;
    };
  }, [empresaId, isOnline]);

  const guardarParametros = useCallback(
    async (actualizados: ParametroViatico[]) => {
      if (!empresaId) throw new Error('No hay empresa activa.');
      setErrorGeo(null);
      setGuardando(true);

      try {
        if (isSupabaseConfigured && supabase) {
          if (!isOnline) {
            throw new Error(
              'Se requiere conexión a internet para guardar las tarifas de la empresa.'
            );
          }
          const filas = actualizados.map((p) => ({
            empresa_id: empresaId,
            codigo: p.codigo,
            concepto: p.concepto,
            unidad: p.unidad,
            monto_rd: p.estado === 'confirmada' ? p.monto_rd : null,
            estado: p.estado,
            actualizado_en: new Date().toISOString(),
          }));

          const { error } = await supabase
            .from('parametros_viaticos')
            .upsert(filas, { onConflict: 'empresa_id,codigo' });

          if (error) {
            throw new Error(error.message);
          }
        }

        setParametros(actualizados);
        try {
          localStorage.setItem(
            KEY_PARAMS(empresaId),
            JSON.stringify(actualizados)
          );
        } catch {
          // Ignorar error de cuota
        }
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'No se pudieron guardar los parámetros.';
        setErrorGeo(msg);
        throw err;
      } finally {
        setGuardando(false);
      }
    },
    [empresaId, isOnline]
  );

  const guardarPoligonoTrabajo = useCallback(
    async (
      poligono: PoligonoParseado,
      trabajoId: string | null
    ): Promise<PoligonoTrabajoGuardado> => {
      if (!empresaId || !usuario) {
        throw new Error('Debes iniciar sesión con una empresa activa.');
      }
      setErrorGeo(null);
      setGuardando(true);

      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `poly-${Date.now()}`;

      const registro: PoligonoTrabajoGuardado = {
        id,
        empresa_id: empresaId,
        trabajo_id: trabajoId,
        nombre_archivo: poligono.nombre,
        formato: poligono.formato,
        geojson: poligono.geojson,
        area_m2: poligono.metricas.area_m2,
        perimetro_m: poligono.metricas.perimetro_m,
        centroide_lat: poligono.metricas.centroide.lat,
        centroide_lng: poligono.metricas.centroide.lng,
        provincia_detectada: poligono.provincia_sugerida,
        creado_en: new Date().toISOString(),
      };

      try {
        if (isSupabaseConfigured && supabase) {
          if (!isOnline) {
            throw new Error(
              'Se requiere conexión a internet para asociar el polígono en la nube.'
            );
          }

          const { error } = await supabase.from('poligonos_trabajo').insert({
            id: registro.id,
            empresa_id: registro.empresa_id,
            trabajo_id: registro.trabajo_id,
            nombre_archivo: registro.nombre_archivo,
            formato: registro.formato,
            geojson: registro.geojson,
            area_m2: registro.area_m2,
            perimetro_m: registro.perimetro_m,
            centroide_lat: registro.centroide_lat,
            centroide_lng: registro.centroide_lng,
            provincia_detectada: registro.provincia_detectada,
            creado_por: usuario.id,
          });

          if (error) {
            throw new Error(error.message);
          }
        }

        setPoligonosGuardados((prev) => {
          const next = [registro, ...prev];
          if (isDemoModeAllowed && !isSupabaseConfigured) {
            try {
              localStorage.setItem(KEY_POLIGONOS(empresaId), JSON.stringify(next));
            } catch {
              // Ignorar error de cuota
            }
          }
          return next;
        });

        return registro;
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'No se pudo guardar el polígono.';
        setErrorGeo(msg);
        throw err;
      } finally {
        setGuardando(false);
      }
    },
    [empresaId, isOnline, usuario]
  );

  return {
    parametros,
    poligonosGuardados,
    cargando,
    guardando,
    errorGeo,
    limpiarErrorGeo: () => setErrorGeo(null),
    guardarParametros,
    guardarPoligonoTrabajo,
  };
}
