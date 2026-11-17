/**
 * Contexto de datos operativos multi-tenant (trabajos, personal, vehículos, asignaciones y bitácora).
 * - Separa estrictamente Supabase real (con caché offline en IndexedDB) del modo demostración.
 * - Valida todas las respuestas de Supabase ({ error }) antes de mutar el estado local.
 * - Sube fotos reales de bitácora al bucket privado `bitacora-fotos` bajo {empresa_id}/{trabajo_id}/{id}.jpg.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { aplicarTransicionEstadoTrabajo } from '../domain/operacion';
import type {
  BitacoraEntrada,
  EstadoTrabajo,
  Personal,
  Trabajo,
  TrabajoPersonal,
  TrabajoVehiculo,
  Vehiculo,
} from '../domain/types';
import {
  ASIGNACIONES_PERSONAL_DEMO,
  ASIGNACIONES_VEHICULO_DEMO,
  BITACORA_DEMO,
  PERSONAL_DEMO,
  TRABAJOS_DEMO,
  VEHICULOS_DEMO,
} from '../lib/demoData';
import {
  eliminarDeColaSincronizacion,
  encolarSincronizacion,
  guardarBitacoraLocal,
  guardarCacheOperacion,
  obtenerBitacoraLocalPorEmpresa,
  obtenerCacheOperacion,
  obtenerColaSincronizacion,
} from '../lib/offlineDb';
import {
  isDemoModeAllowed,
  isSupabaseConfigured,
  supabase,
} from '../lib/supabase';
import { useAuth } from './useAuth';
import { useOnlineStatus } from './useOnlineStatus';

interface OperacionContextValue {
  trabajos: Trabajo[];
  personal: Personal[];
  vehiculos: Vehiculo[];
  asignacionesPersonal: TrabajoPersonal[];
  asignacionesVehiculo: TrabajoVehiculo[];
  bitacora: BitacoraEntrada[];
  pendientesSincronizar: number;
  sincronizando: boolean;
  ultimoErrorSincronizacion: string | null;
  cargandoDatos: boolean;
  errorOperacion: string | null;
  limpiarErrorOperacion: () => void;
  // CRUD Trabajos
  guardarTrabajo: (
    trabajo: Omit<Trabajo, 'id' | 'empresa_id'> & { id?: string }
  ) => Promise<Trabajo>;
  actualizarEstadoTrabajo: (
    trabajoId: string,
    nuevoEstado: EstadoTrabajo
  ) => Promise<void>;
  eliminarTrabajo: (id: string) => Promise<void>;
  // CRUD Personal
  guardarPersonal: (
    persona: Omit<Personal, 'id' | 'empresa_id'> & { id?: string }
  ) => Promise<void>;
  eliminarPersonal: (id: string) => Promise<void>;
  // CRUD Vehículos
  guardarVehiculo: (
    vehiculo: Omit<Vehiculo, 'id' | 'empresa_id'> & { id?: string }
  ) => Promise<void>;
  eliminarVehiculo: (id: string) => Promise<void>;
  // Asignaciones por fecha
  asignarPersonalATrabajo: (
    trabajoId: string,
    personalId: string,
    fecha: string
  ) => Promise<void>;
  quitarPersonalDeTrabajo: (asignacionId: string) => Promise<void>;
  asignarVehiculoATrabajo: (
    trabajoId: string,
    vehiculoId: string,
    fecha: string
  ) => Promise<void>;
  quitarVehiculoDeTrabajo: (asignacionId: string) => Promise<void>;
  // Bitácora con soporte offline y Storage
  agregarEntradaBitacora: (
    trabajoId: string,
    nota: string,
    fotoArchivo: File | Blob | null
  ) => Promise<void>;
  sincronizarColaAhora: () => Promise<void>;
}

const OperacionContext = createContext<OperacionContextValue | null>(null);

const generarId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function blobADataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('No se pudo leer la imagen.'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function traducirErrorSupabase(mensaje: string): string {
  if (mensaje.includes('row-level security')) {
    return 'No tienes permisos suficientes en tu rol actual para realizar esta acción.';
  }
  return mensaje;
}

export const OperacionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { empresaActiva, usuario, rolActivo } = useAuth();
  const isOnline = useOnlineStatus();

  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [asignacionesPersonal, setAsignacionesPersonal] = useState<
    TrabajoPersonal[]
  >([]);
  const [asignacionesVehiculo, setAsignacionesVehiculo] = useState<
    TrabajoVehiculo[]
  >([]);
  const [bitacora, setBitacora] = useState<BitacoraEntrada[]>([]);
  const [pendientesSincronizar, setPendientesSincronizar] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimoErrorSincronizacion, setUltimoErrorSincronizacion] = useState<
    string | null
  >(null);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [errorOperacion, setErrorOperacion] = useState<string | null>(null);

  const empresaId = empresaActiva?.id ?? null;

  const limpiarErrorOperacion = () => setErrorOperacion(null);

  // Resuelve URLs firmadas para fotos almacenadas en el bucket privado bitacora-fotos
  const resolverPreviewsBitacora = useCallback(
    async (entradas: BitacoraEntrada[]): Promise<BitacoraEntrada[]> => {
      if (!isSupabaseConfigured || !supabase || !isOnline) {
        return entradas;
      }

      const rutas = entradas
        .map((e) => e.foto_url)
        .filter(
          (ruta): ruta is string =>
            Boolean(ruta) &&
            !ruta!.startsWith('data:') &&
            !ruta!.startsWith('http')
        );

      if (rutas.length === 0) return entradas;

      const { data, error } = await supabase.storage
        .from('bitacora-fotos')
        .createSignedUrls(rutas, 60 * 60);

      if (error || !data) return entradas;

      const mapaUrls = new Map<string, string>();
      for (const item of data) {
        if (item.path && item.signedUrl) {
          mapaUrls.set(item.path, item.signedUrl);
        }
      }

      return entradas.map((e) =>
        e.foto_url && mapaUrls.has(e.foto_url)
          ? { ...e, foto_preview_url: mapaUrls.get(e.foto_url) ?? null }
          : e
      );
    },
    [isOnline]
  );

  // Cargar datos iniciales al cambiar de empresa o conectividad
  useEffect(() => {
    if (!empresaId) {
      setTrabajos([]);
      setPersonal([]);
      setVehiculos([]);
      setAsignacionesPersonal([]);
      setAsignacionesVehiculo([]);
      setBitacora([]);
      setPendientesSincronizar(0);
      return;
    }

    let activo = true;

    const cargar = async () => {
      setCargandoDatos(true);
      setErrorOperacion(null);

      let bitacoraOffline: BitacoraEntrada[] = [];
      try {
        bitacoraOffline = await obtenerBitacoraLocalPorEmpresa(empresaId);
        const cola = await obtenerColaSincronizacion();
        if (activo) {
          setPendientesSincronizar(
            cola.filter((c) => c.empresa_id === empresaId).length
          );
        }
      } catch {
        // IndexedDB no disponible
      }

      if (isSupabaseConfigured && supabase) {
        if (isOnline) {
          const [resT, resP, resV, resAP, resAV, resB] = await Promise.all([
            supabase
              .from('trabajos')
              .select('*')
              .eq('empresa_id', empresaId)
              .order('fecha_prevista', { ascending: true }),
            supabase
              .from('personal')
              .select('*')
              .eq('empresa_id', empresaId)
              .order('nombre', { ascending: true }),
            supabase
              .from('vehiculos')
              .select('*')
              .eq('empresa_id', empresaId)
              .order('nombre', { ascending: true }),
            supabase
              .from('trabajo_personal')
              .select('*')
              .eq('empresa_id', empresaId),
            supabase
              .from('trabajo_vehiculo')
              .select('*')
              .eq('empresa_id', empresaId),
            supabase
              .from('bitacora')
              .select('*')
              .eq('empresa_id', empresaId)
              .order('fecha_hora', { ascending: false }),
          ]);

          if (!activo) return;

          const primerError =
            resT.error ||
            resP.error ||
            resV.error ||
            resAP.error ||
            resAV.error ||
            resB.error;

          if (!primerError) {
            const listaT = (resT.data as Trabajo[]) ?? [];
            const listaP = (resP.data as Personal[]) ?? [];
            const listaV = (resV.data as Vehiculo[]) ?? [];
            const listaAP = (resAP.data as TrabajoPersonal[]) ?? [];
            const listaAV = (resAV.data as TrabajoVehiculo[]) ?? [];

            setTrabajos(listaT);
            setPersonal(listaP);
            setVehiculos(listaV);
            setAsignacionesPersonal(listaAP);
            setAsignacionesVehiculo(listaAV);

            try {
              await guardarCacheOperacion({
                empresa_id: empresaId,
                trabajos: listaT,
                personal: listaP,
                vehiculos: listaV,
                asignacionesPersonal: listaAP,
                asignacionesVehiculo: listaAV,
                actualizado_en: new Date().toISOString(),
              });
            } catch {
              // Ignorar error de cuota en IndexedDB
            }

            const remotas = await resolverPreviewsBitacora(
              (resB.data as BitacoraEntrada[]) ?? []
            );
            const idsRemotos = new Set(remotas.map((b) => b.id));
            const combinadas = [
              ...bitacoraOffline.filter((b) => !idsRemotos.has(b.id)),
              ...remotas,
            ].sort((a, b) => b.fecha_hora.localeCompare(a.fecha_hora));

            if (activo) {
              setBitacora(combinadas);
              setCargandoDatos(false);
            }
            return;
          }
        }

        // Sin conexión (o fallo de red) con Supabase configurado: leer caché offline de IndexedDB
        try {
          const cache = await obtenerCacheOperacion(empresaId);
          if (activo && cache) {
            setTrabajos(cache.trabajos);
            setPersonal(cache.personal);
            setVehiculos(cache.vehiculos);
            setAsignacionesPersonal(cache.asignacionesPersonal);
            setAsignacionesVehiculo(cache.asignacionesVehiculo);
          }
        } catch {
          // Sin caché disponible
        }

        if (activo) {
          setBitacora(
            bitacoraOffline.sort((a, b) =>
              b.fecha_hora.localeCompare(a.fecha_hora)
            )
          );
          setCargandoDatos(false);
        }
        return;
      }

      // Modo demostración local (solo si isDemoModeAllowed es verdadero)
      if (isDemoModeAllowed) {
        if (!activo) return;
        setTrabajos(TRABAJOS_DEMO.filter((t) => t.empresa_id === empresaId));
        setPersonal(PERSONAL_DEMO.filter((p) => p.empresa_id === empresaId));
        setVehiculos(VEHICULOS_DEMO.filter((v) => v.empresa_id === empresaId));
        setAsignacionesPersonal(
          ASIGNACIONES_PERSONAL_DEMO.filter((a) => a.empresa_id === empresaId)
        );
        setAsignacionesVehiculo(
          ASIGNACIONES_VEHICULO_DEMO.filter((a) => a.empresa_id === empresaId)
        );

        const baseBitacora = BITACORA_DEMO.filter(
          (b) => b.empresa_id === empresaId
        );
        const idsBase = new Set(baseBitacora.map((b) => b.id));
        const combinadas = [
          ...bitacoraOffline.filter((b) => !idsBase.has(b.id)),
          ...baseBitacora,
        ].sort((a, b) => b.fecha_hora.localeCompare(a.fecha_hora));
        setBitacora(combinadas);
      }

      if (activo) setCargandoDatos(false);
    };

    cargar();
    return () => {
      activo = false;
    };
  }, [empresaId, isOnline, resolverPreviewsBitacora]);

  // Sincronización automática de la cola de bitácora (Storage + Postgres) al volver la señal
  const sincronizarColaAhora = useCallback(async () => {
    if (!isOnline || !empresaId) return;
    setSincronizando(true);
    setUltimoErrorSincronizacion(null);

    try {
      const cola = await obtenerColaSincronizacion();
      const pendientesEmpresa = cola.filter((c) => c.empresa_id === empresaId);

      for (const item of pendientesEmpresa) {
        let fotoRuta = item.payload.foto_url;

        if (isSupabaseConfigured && supabase) {
          // 1. Subir el archivo binario al bucket privado bitacora-fotos si existe
          if (item.foto_blob && fotoRuta) {
            const { error: uploadError } = await supabase.storage
              .from('bitacora-fotos')
              .upload(fotoRuta, item.foto_blob, {
                contentType: item.foto_blob.type || 'image/jpeg',
                upsert: true,
              });

            if (uploadError) {
              await encolarSincronizacion({
                ...item,
                intentos: item.intentos + 1,
                ultimo_error: uploadError.message,
              });
              setUltimoErrorSincronizacion(
                `Error subiendo foto: ${uploadError.message}`
              );
              continue;
            }
          }

          // 2. Insertar entrada en la tabla bitacora
          const { error: insertError } = await supabase.from('bitacora').insert({
            id: item.payload.id,
            empresa_id: item.payload.empresa_id,
            trabajo_id: item.payload.trabajo_id,
            autor_id: item.payload.autor_id,
            autor_nombre: item.payload.autor_nombre ?? '',
            fecha_hora: item.payload.fecha_hora,
            nota: item.payload.nota,
            foto_url: fotoRuta,
          });

          if (insertError) {
            await encolarSincronizacion({
              ...item,
              intentos: item.intentos + 1,
              ultimo_error: insertError.message,
            });
            setUltimoErrorSincronizacion(
              traducirErrorSupabase(insertError.message)
            );
            continue;
          }
        }

        const entradaSincronizada: BitacoraEntrada = {
          ...item.payload,
          foto_url: fotoRuta,
          pendiente_sincronizar: false,
        };
        await guardarBitacoraLocal(entradaSincronizada);
        await eliminarDeColaSincronizacion(item.id);
        setBitacora((prev) =>
          prev.map((b) => (b.id === item.payload.id ? entradaSincronizada : b))
        );
      }

      const restante = await obtenerColaSincronizacion();
      setPendientesSincronizar(
        restante.filter((c) => c.empresa_id === empresaId).length
      );
    } finally {
      setSincronizando(false);
    }
  }, [empresaId, isOnline]);

  useEffect(() => {
    if (isOnline && pendientesSincronizar > 0) {
      sincronizarColaAhora();
    }
  }, [isOnline, pendientesSincronizar, sincronizarColaAhora]);

  const exigirConexionParaAdmin = () => {
    if (isSupabaseConfigured && !isOnline) {
      const msg =
        'Se requiere conexión a internet para guardar cambios administrativos.';
      setErrorOperacion(msg);
      throw new Error(msg);
    }
  };

  // --- CRUD TRABAJOS ---
  const guardarTrabajo = async (
    datos: Omit<Trabajo, 'id' | 'empresa_id'> & { id?: string }
  ): Promise<Trabajo> => {
    if (!empresaId) throw new Error('No hay empresa activa.');
    exigirConexionParaAdmin();
    setErrorOperacion(null);

    const registro: Trabajo = {
      ...datos,
      id: datos.id ?? generarId(),
      empresa_id: empresaId,
    };

    if (isSupabaseConfigured && supabase) {
      const res = datos.id
        ? await supabase
            .from('trabajos')
            .update(registro)
            .eq('id', datos.id)
            .eq('empresa_id', empresaId)
        : await supabase.from('trabajos').insert(registro);

      if (res.error) {
        const msg = traducirErrorSupabase(res.error.message);
        setErrorOperacion(msg);
        throw new Error(msg);
      }
    }

    setTrabajos((prev) => {
      const existe = prev.some((t) => t.id === registro.id);
      return existe
        ? prev.map((t) => (t.id === registro.id ? registro : t))
        : [registro, ...prev];
    });

    return registro;
  };

  const actualizarEstadoTrabajo = async (
    trabajoId: string,
    nuevoEstado: EstadoTrabajo
  ) => {
    if (!empresaId) return;
    exigirConexionParaAdmin();
    setErrorOperacion(null);

    const actual = trabajos.find((t) => t.id === trabajoId);
    if (!actual) return;

    const actualizado = aplicarTransicionEstadoTrabajo(actual, nuevoEstado);

    if (isSupabaseConfigured && supabase) {
      if (rolActivo === 'tecnico') {
        const { error } = await supabase.rpc('actualizar_estado_trabajo_campo', {
          p_trabajo_id: trabajoId,
          p_estado: actualizado.estado,
          p_fecha_inicio_real: actualizado.fecha_inicio_real,
          p_fecha_fin_real: actualizado.fecha_fin_real,
        });
        if (error) {
          const msg = traducirErrorSupabase(error.message);
          setErrorOperacion(msg);
          throw new Error(msg);
        }
      } else {
        const { error } = await supabase
          .from('trabajos')
          .update({
            estado: actualizado.estado,
            fecha_inicio_real: actualizado.fecha_inicio_real,
            fecha_fin_real: actualizado.fecha_fin_real,
          })
          .eq('id', trabajoId)
          .eq('empresa_id', empresaId);

        if (error) {
          const msg = traducirErrorSupabase(error.message);
          setErrorOperacion(msg);
          throw new Error(msg);
        }
      }
    }

    setTrabajos((prev) =>
      prev.map((t) => (t.id === trabajoId ? actualizado : t))
    );
  };

  const eliminarTrabajo = async (id: string) => {
    if (!empresaId) return;
    exigirConexionParaAdmin();
    setErrorOperacion(null);

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('trabajos')
        .delete()
        .eq('id', id)
        .eq('empresa_id', empresaId);

      if (error) {
        const msg = traducirErrorSupabase(error.message);
        setErrorOperacion(msg);
        throw new Error(msg);
      }
    }

    setTrabajos((prev) => prev.filter((t) => t.id !== id));
    setAsignacionesPersonal((prev) => prev.filter((a) => a.trabajo_id !== id));
    setAsignacionesVehiculo((prev) => prev.filter((a) => a.trabajo_id !== id));
  };

  // --- CRUD PERSONAL ---
  const guardarPersonal = async (
    datos: Omit<Personal, 'id' | 'empresa_id'> & { id?: string }
  ) => {
    if (!empresaId) return;
    exigirConexionParaAdmin();
    setErrorOperacion(null);

    const registro: Personal = {
      ...datos,
      id: datos.id ?? generarId(),
      empresa_id: empresaId,
    };

    if (isSupabaseConfigured && supabase) {
      const res = datos.id
        ? await supabase
            .from('personal')
            .update(registro)
            .eq('id', datos.id)
            .eq('empresa_id', empresaId)
        : await supabase.from('personal').insert(registro);

      if (res.error) {
        const msg = traducirErrorSupabase(res.error.message);
        setErrorOperacion(msg);
        throw new Error(msg);
      }
    }

    setPersonal((prev) => {
      const existe = prev.some((p) => p.id === registro.id);
      return existe
        ? prev.map((p) => (p.id === registro.id ? registro : p))
        : [...prev, registro];
    });
  };

  const eliminarPersonal = async (id: string) => {
    if (!empresaId) return;
    exigirConexionParaAdmin();
    setErrorOperacion(null);

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('personal')
        .delete()
        .eq('id', id)
        .eq('empresa_id', empresaId);

      if (error) {
        const msg = traducirErrorSupabase(error.message);
        setErrorOperacion(msg);
        throw new Error(msg);
      }
    }

    setPersonal((prev) => prev.filter((p) => p.id !== id));
    setAsignacionesPersonal((prev) => prev.filter((a) => a.personal_id !== id));
  };

  // --- CRUD VEHÍCULOS ---
  const guardarVehiculo = async (
    datos: Omit<Vehiculo, 'id' | 'empresa_id'> & { id?: string }
  ) => {
    if (!empresaId) return;
    exigirConexionParaAdmin();
    setErrorOperacion(null);

    const registro: Vehiculo = {
      ...datos,
      id: datos.id ?? generarId(),
      empresa_id: empresaId,
    };

    if (isSupabaseConfigured && supabase) {
      const res = datos.id
        ? await supabase
            .from('vehiculos')
            .update(registro)
            .eq('id', datos.id)
            .eq('empresa_id', empresaId)
        : await supabase.from('vehiculos').insert(registro);

      if (res.error) {
        const msg = traducirErrorSupabase(res.error.message);
        setErrorOperacion(msg);
        throw new Error(msg);
      }
    }

    setVehiculos((prev) => {
      const existe = prev.some((v) => v.id === registro.id);
      return existe
        ? prev.map((v) => (v.id === registro.id ? registro : v))
        : [...prev, registro];
    });
  };

  const eliminarVehiculo = async (id: string) => {
    if (!empresaId) return;
    exigirConexionParaAdmin();
    setErrorOperacion(null);

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('vehiculos')
        .delete()
        .eq('id', id)
        .eq('empresa_id', empresaId);

      if (error) {
        const msg = traducirErrorSupabase(error.message);
        setErrorOperacion(msg);
        throw new Error(msg);
      }
    }

    setVehiculos((prev) => prev.filter((v) => v.id !== id));
    setAsignacionesVehiculo((prev) => prev.filter((a) => a.vehiculo_id !== id));
  };

  // --- ASIGNACIONES ---
  const asignarPersonalATrabajo = async (
    trabajoId: string,
    personalId: string,
    fecha: string
  ) => {
    if (!empresaId) return;
    exigirConexionParaAdmin();
    setErrorOperacion(null);

    const yaExiste = asignacionesPersonal.some(
      (a) =>
        a.trabajo_id === trabajoId &&
        a.personal_id === personalId &&
        a.fecha === fecha
    );
    if (yaExiste) return;

    const nueva: TrabajoPersonal = {
      id: generarId(),
      empresa_id: empresaId,
      trabajo_id: trabajoId,
      personal_id: personalId,
      fecha,
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('trabajo_personal').insert(nueva);
      if (error) {
        const msg = traducirErrorSupabase(error.message);
        setErrorOperacion(msg);
        throw new Error(msg);
      }
    }
    setAsignacionesPersonal((prev) => [...prev, nueva]);
  };

  const quitarPersonalDeTrabajo = async (asignacionId: string) => {
    if (!empresaId) return;
    exigirConexionParaAdmin();
    setErrorOperacion(null);

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('trabajo_personal')
        .delete()
        .eq('id', asignacionId)
        .eq('empresa_id', empresaId);

      if (error) {
        const msg = traducirErrorSupabase(error.message);
        setErrorOperacion(msg);
        throw new Error(msg);
      }
    }
    setAsignacionesPersonal((prev) =>
      prev.filter((a) => a.id !== asignacionId)
    );
  };

  const asignarVehiculoATrabajo = async (
    trabajoId: string,
    vehiculoId: string,
    fecha: string
  ) => {
    if (!empresaId) return;
    exigirConexionParaAdmin();
    setErrorOperacion(null);

    const yaExiste = asignacionesVehiculo.some(
      (a) =>
        a.trabajo_id === trabajoId &&
        a.vehiculo_id === vehiculoId &&
        a.fecha === fecha
    );
    if (yaExiste) return;

    const nueva: TrabajoVehiculo = {
      id: generarId(),
      empresa_id: empresaId,
      trabajo_id: trabajoId,
      vehiculo_id: vehiculoId,
      fecha,
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('trabajo_vehiculo').insert(nueva);
      if (error) {
        const msg = traducirErrorSupabase(error.message);
        setErrorOperacion(msg);
        throw new Error(msg);
      }
    }
    setAsignacionesVehiculo((prev) => [...prev, nueva]);
  };

  const quitarVehiculoDeTrabajo = async (asignacionId: string) => {
    if (!empresaId) return;
    exigirConexionParaAdmin();
    setErrorOperacion(null);

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('trabajo_vehiculo')
        .delete()
        .eq('id', asignacionId)
        .eq('empresa_id', empresaId);

      if (error) {
        const msg = traducirErrorSupabase(error.message);
        setErrorOperacion(msg);
        throw new Error(msg);
      }
    }
    setAsignacionesVehiculo((prev) =>
      prev.filter((a) => a.id !== asignacionId)
    );
  };

  // --- BITÁCORA OFFLINE-FIRST + SUPABASE STORAGE ---
  const agregarEntradaBitacora = async (
    trabajoId: string,
    nota: string,
    fotoArchivo: File | Blob | null
  ) => {
    if (!empresaId || !usuario) return;
    setErrorOperacion(null);

    const entradaId = generarId();
    const rutaStorage = fotoArchivo
      ? `${empresaId}/${trabajoId}/${entradaId}.jpg`
      : null;

    let previewLocal: string | null = null;
    if (fotoArchivo) {
      try {
        previewLocal = await blobADataUrl(fotoArchivo);
      } catch {
        previewLocal = null;
      }
    }

    const entrada: BitacoraEntrada = {
      id: entradaId,
      empresa_id: empresaId,
      trabajo_id: trabajoId,
      autor_id: usuario.id,
      autor_nombre: usuario.nombre,
      fecha_hora: new Date().toISOString(),
      nota: nota.trim(),
      foto_url: isSupabaseConfigured ? rutaStorage : previewLocal,
      foto_preview_url: previewLocal,
      pendiente_sincronizar: isSupabaseConfigured && !isOnline,
    };

    try {
      await guardarBitacoraLocal(entrada);
    } catch {
      // Continuar con estado en memoria si IndexedDB falla
    }

    if (isSupabaseConfigured && supabase) {
      if (!isOnline) {
        await encolarSincronizacion({
          id: generarId(),
          tipo: 'bitacora_crear',
          empresa_id: empresaId,
          payload: entrada,
          foto_blob: fotoArchivo,
          creado_en: new Date().toISOString(),
          intentos: 0,
        });
        setPendientesSincronizar((c) => c + 1);
      } else {
        let falloRemoto: string | null = null;

        if (fotoArchivo && rutaStorage) {
          const { error: uploadError } = await supabase.storage
            .from('bitacora-fotos')
            .upload(rutaStorage, fotoArchivo, {
              contentType: fotoArchivo.type || 'image/jpeg',
              upsert: true,
            });
          if (uploadError) {
            falloRemoto = uploadError.message;
          }
        }

        if (!falloRemoto) {
          const { error: insertError } = await supabase.from('bitacora').insert({
            id: entrada.id,
            empresa_id: entrada.empresa_id,
            trabajo_id: entrada.trabajo_id,
            autor_id: entrada.autor_id,
            autor_nombre: entrada.autor_nombre ?? '',
            fecha_hora: entrada.fecha_hora,
            nota: entrada.nota,
            foto_url: entrada.foto_url,
          });
          if (insertError) {
            falloRemoto = insertError.message;
          }
        }

        if (falloRemoto) {
          entrada.pendiente_sincronizar = true;
          await guardarBitacoraLocal(entrada);
          await encolarSincronizacion({
            id: generarId(),
            tipo: 'bitacora_crear',
            empresa_id: empresaId,
            payload: entrada,
            foto_blob: fotoArchivo,
            creado_en: new Date().toISOString(),
            intentos: 1,
            ultimo_error: falloRemoto,
          });
          setPendientesSincronizar((c) => c + 1);
          setUltimoErrorSincronizacion(traducirErrorSupabase(falloRemoto));
        }
      }
    }

    setBitacora((prev) => [entrada, ...prev]);
  };

  return (
    <OperacionContext.Provider
      value={{
        trabajos,
        personal,
        vehiculos,
        asignacionesPersonal,
        asignacionesVehiculo,
        bitacora,
        pendientesSincronizar,
        sincronizando,
        ultimoErrorSincronizacion,
        cargandoDatos,
        errorOperacion,
        limpiarErrorOperacion,
        guardarTrabajo,
        actualizarEstadoTrabajo,
        eliminarTrabajo,
        guardarPersonal,
        eliminarPersonal,
        guardarVehiculo,
        eliminarVehiculo,
        asignarPersonalATrabajo,
        quitarPersonalDeTrabajo,
        asignarVehiculoATrabajo,
        quitarVehiculoDeTrabajo,
        agregarEntradaBitacora,
        sincronizarColaAhora,
      }}
    >
      {children}
    </OperacionContext.Provider>
  );
};

export function useOperacionData(): OperacionContextValue {
  const ctx = useContext(OperacionContext);
  if (!ctx) {
    throw new Error(
      'useOperacionData debe utilizarse dentro de OperacionProvider.'
    );
  }
  return ctx;
}
