/**
 * Contexto de datos operativos multi-tenant (trabajos, personal, vehículos, asignaciones y bitácora).
 * - Filtra siempre por empresaActiva.id.
 * - Si Supabase está configurado, sincroniza con Postgres y Storage.
 * - La bitácora guarda siempre en IndexedDB cuando no hay señal y sincroniza automáticamente al reconectar.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type {
  BitacoraEntrada,
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
  obtenerBitacoraLocalPorEmpresa,
  obtenerColaSincronizacion,
} from '../lib/offlineDb';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
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
  cargandoDatos: boolean;
  // CRUD Trabajos
  guardarTrabajo: (trabajo: Omit<Trabajo, 'id' | 'empresa_id'> & { id?: string }) => Promise<Trabajo>;
  eliminarTrabajo: (id: string) => Promise<void>;
  // CRUD Personal
  guardarPersonal: (persona: Omit<Personal, 'id' | 'empresa_id'> & { id?: string }) => Promise<void>;
  eliminarPersonal: (id: string) => Promise<void>;
  // CRUD Vehículos
  guardarVehiculo: (vehiculo: Omit<Vehiculo, 'id' | 'empresa_id'> & { id?: string }) => Promise<void>;
  eliminarVehiculo: (id: string) => Promise<void>;
  // Asignaciones por fecha
  asignarPersonalATrabajo: (trabajoId: string, personalId: string, fecha: string) => Promise<void>;
  quitarPersonalDeTrabajo: (asignacionId: string) => Promise<void>;
  asignarVehiculoATrabajo: (trabajoId: string, vehiculoId: string, fecha: string) => Promise<void>;
  quitarVehiculoDeTrabajo: (asignacionId: string) => Promise<void>;
  // Bitácora con soporte offline
  agregarEntradaBitacora: (trabajoId: string, nota: string, fotoDataUrl: string | null) => Promise<void>;
  sincronizarColaAhora: () => Promise<void>;
}

const OperacionContext = createContext<OperacionContextValue | null>(null);

const generarId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const OperacionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { empresaActiva, usuario } = useAuth();
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
  const [cargandoDatos, setCargandoDatos] = useState(false);

  const empresaId = empresaActiva?.id ?? null;

  // Cargar datos iniciales al cambiar de empresa
  useEffect(() => {
    if (!empresaId) {
      setTrabajos([]);
      setPersonal([]);
      setVehiculos([]);
      setAsignacionesPersonal([]);
      setAsignacionesVehiculo([]);
      setBitacora([]);
      return;
    }

    let activo = true;

    const cargar = async () => {
      setCargandoDatos(true);

      // Siempre recuperamos entradas offline guardadas en IndexedDB
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
        // IndexedDB podría no estar disponible en modo privado estricto
      }

      if (isSupabaseConfigured && supabase && isOnline) {
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
        setTrabajos((resT.data as Trabajo[]) ?? []);
        setPersonal((resP.data as Personal[]) ?? []);
        setVehiculos((resV.data as Vehiculo[]) ?? []);
        setAsignacionesPersonal((resAP.data as TrabajoPersonal[]) ?? []);
        setAsignacionesVehiculo((resAV.data as TrabajoVehiculo[]) ?? []);

        const remotas = (resB.data as BitacoraEntrada[]) ?? [];
        const idsRemotos = new Set(remotas.map((b) => b.id));
        const combinadas = [
          ...bitacoraOffline.filter((b) => !idsRemotos.has(b.id)),
          ...remotas,
        ].sort((a, b) => b.fecha_hora.localeCompare(a.fecha_hora));
        setBitacora(combinadas);
      } else {
        // Modo demostración local filtrado estrictamente por empresa_id
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
  }, [empresaId, isOnline]);

  // Sincronización automática de la cola de bitácora cuando regresa la señal
  const sincronizarColaAhora = useCallback(async () => {
    if (!isOnline || !empresaId) return;
    setSincronizando(true);
    try {
      const cola = await obtenerColaSincronizacion();
      const pendientesEmpresa = cola.filter((c) => c.empresa_id === empresaId);

      for (const item of pendientesEmpresa) {
        if (isSupabaseConfigured && supabase) {
          const { error } = await supabase.from('bitacora').insert({
            id: item.payload.id,
            empresa_id: item.payload.empresa_id,
            trabajo_id: item.payload.trabajo_id,
            autor_id: item.payload.autor_id,
            fecha_hora: item.payload.fecha_hora,
            nota: item.payload.nota,
            foto_url: item.payload.foto_url,
          });
          if (error) continue;
        }

        const entradaSincronizada: BitacoraEntrada = {
          ...item.payload,
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

  // --- CRUD TRABAJOS ---
  const guardarTrabajo = async (
    datos: Omit<Trabajo, 'id' | 'empresa_id'> & { id?: string }
  ): Promise<Trabajo> => {
    if (!empresaId) throw new Error('No hay empresa activa.');

    const registro: Trabajo = {
      ...datos,
      id: datos.id ?? generarId(),
      empresa_id: empresaId,
    };

    if (isSupabaseConfigured && supabase && isOnline) {
      if (datos.id) {
        await supabase
          .from('trabajos')
          .update(registro)
          .eq('id', datos.id)
          .eq('empresa_id', empresaId);
      } else {
        await supabase.from('trabajos').insert(registro);
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

  const eliminarTrabajo = async (id: string) => {
    if (!empresaId) return;
    if (isSupabaseConfigured && supabase && isOnline) {
      await supabase
        .from('trabajos')
        .delete()
        .eq('id', id)
        .eq('empresa_id', empresaId);
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
    const registro: Personal = {
      ...datos,
      id: datos.id ?? generarId(),
      empresa_id: empresaId,
    };

    if (isSupabaseConfigured && supabase && isOnline) {
      if (datos.id) {
        await supabase
          .from('personal')
          .update(registro)
          .eq('id', datos.id)
          .eq('empresa_id', empresaId);
      } else {
        await supabase.from('personal').insert(registro);
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
    if (isSupabaseConfigured && supabase && isOnline) {
      await supabase
        .from('personal')
        .delete()
        .eq('id', id)
        .eq('empresa_id', empresaId);
    }
    setPersonal((prev) => prev.filter((p) => p.id !== id));
    setAsignacionesPersonal((prev) => prev.filter((a) => a.personal_id !== id));
  };

  // --- CRUD VEHÍCULOS ---
  const guardarVehiculo = async (
    datos: Omit<Vehiculo, 'id' | 'empresa_id'> & { id?: string }
  ) => {
    if (!empresaId) return;
    const registro: Vehiculo = {
      ...datos,
      id: datos.id ?? generarId(),
      empresa_id: empresaId,
    };

    if (isSupabaseConfigured && supabase && isOnline) {
      if (datos.id) {
        await supabase
          .from('vehiculos')
          .update(registro)
          .eq('id', datos.id)
          .eq('empresa_id', empresaId);
      } else {
        await supabase.from('vehiculos').insert(registro);
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
    if (isSupabaseConfigured && supabase && isOnline) {
      await supabase
        .from('vehiculos')
        .delete()
        .eq('id', id)
        .eq('empresa_id', empresaId);
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

    if (isSupabaseConfigured && supabase && isOnline) {
      await supabase.from('trabajo_personal').insert(nueva);
    }
    setAsignacionesPersonal((prev) => [...prev, nueva]);
  };

  const quitarPersonalDeTrabajo = async (asignacionId: string) => {
    if (!empresaId) return;
    if (isSupabaseConfigured && supabase && isOnline) {
      await supabase
        .from('trabajo_personal')
        .delete()
        .eq('id', asignacionId)
        .eq('empresa_id', empresaId);
    }
    setAsignacionesPersonal((prev) => prev.filter((a) => a.id !== asignacionId));
  };

  const asignarVehiculoATrabajo = async (
    trabajoId: string,
    vehiculoId: string,
    fecha: string
  ) => {
    if (!empresaId) return;
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

    if (isSupabaseConfigured && supabase && isOnline) {
      await supabase.from('trabajo_vehiculo').insert(nueva);
    }
    setAsignacionesVehiculo((prev) => [...prev, nueva]);
  };

  const quitarVehiculoDeTrabajo = async (asignacionId: string) => {
    if (!empresaId) return;
    if (isSupabaseConfigured && supabase && isOnline) {
      await supabase
        .from('trabajo_vehiculo')
        .delete()
        .eq('id', asignacionId)
        .eq('empresa_id', empresaId);
    }
    setAsignacionesVehiculo((prev) => prev.filter((a) => a.id !== asignacionId));
  };

  // --- BITÁCORA OFFLINE-FIRST ---
  const agregarEntradaBitacora = async (
    trabajoId: string,
    nota: string,
    fotoDataUrl: string | null
  ) => {
    if (!empresaId || !usuario) return;

    const entrada: BitacoraEntrada = {
      id: generarId(),
      empresa_id: empresaId,
      trabajo_id: trabajoId,
      autor_id: usuario.id,
      autor_nombre: usuario.nombre,
      fecha_hora: new Date().toISOString(),
      nota: nota.trim(),
      foto_url: fotoDataUrl,
      pendiente_sincronizar: !isOnline,
    };

    // Guardamos siempre en IndexedDB para garantizar persistencia en campo
    try {
      await guardarBitacoraLocal(entrada);
    } catch {
      // Continuar con estado en memoria si IndexedDB falla
    }

    if (!isOnline) {
      try {
        await encolarSincronizacion({
          id: generarId(),
          tipo: 'bitacora_crear',
          empresa_id: empresaId,
          payload: entrada,
          creado_en: new Date().toISOString(),
          intentos: 0,
        });
        setPendientesSincronizar((c) => c + 1);
      } catch {
        // Fallback silencioso
      }
    } else if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('bitacora').insert({
        id: entrada.id,
        empresa_id: entrada.empresa_id,
        trabajo_id: entrada.trabajo_id,
        autor_id: entrada.autor_id,
        fecha_hora: entrada.fecha_hora,
        nota: entrada.nota,
        foto_url: entrada.foto_url,
      });
      if (error) {
        entrada.pendiente_sincronizar = true;
        await encolarSincronizacion({
          id: generarId(),
          tipo: 'bitacora_crear',
          empresa_id: empresaId,
          payload: entrada,
          creado_en: new Date().toISOString(),
          intentos: 1,
        });
        setPendientesSincronizar((c) => c + 1);
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
        cargandoDatos,
        guardarTrabajo,
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
