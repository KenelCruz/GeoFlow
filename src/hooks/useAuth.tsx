/**
 * Contexto de autenticación y selección de empresa activa (multi-tenant).
 * Soporta Supabase Auth real y modo demostración solo cuando isDemoModeAllowed es verdadero.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import type {
  Empresa,
  RolEmpresa,
  UsuarioEmpresa,
  UsuarioSesion,
} from '../domain/types';
import { MEMBRESIAS_DEMO, USUARIO_DEMO } from '../lib/demoData';
import { limpiarCacheAlCerrarSesion } from '../lib/offlineDb';
import {
  isDemoModeAllowed,
  isSupabaseConfigured,
  isSupabaseMissingInProd,
  supabase,
} from '../lib/supabase';

interface AuthContextValue {
  usuario: UsuarioSesion | null;
  membresias: UsuarioEmpresa[];
  empresaActiva: Empresa | null;
  rolActivo: RolEmpresa | null;
  cargando: boolean;
  modoDemo: boolean;
  errorConfiguracion: boolean;
  iniciarSesion: (email: string, password: string) => Promise<{ error?: string }>;
  iniciarSesionDemo: () => void;
  seleccionarEmpresa: (empresaId: string) => void;
  cerrarSesion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_EMPRESA_KEY = 'cotizador_empresa_activa_id';
const STORAGE_DEMO_AUTH_KEY = 'cotizador_demo_autenticado';
const STORAGE_MEMBRESIAS_CACHE_KEY = 'cotizador_membresias_cache';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [membresias, setMembresias] = useState<UsuarioEmpresa[]>([]);
  const [empresaActivaId, setEmpresaActivaId] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_EMPRESA_KEY)
  );
  const [cargando, setCargando] = useState(true);

  // Carga las empresas a las que pertenece el usuario desde Supabase (con respaldo en caché si está offline)
  const cargarMembresiasSupabase = async (userId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('usuarios_empresa')
      .select('usuario_id, empresa_id, rol, empresa:empresas(*)')
      .eq('usuario_id', userId);

    if (!error && data) {
      const lista = data.map((row: Record<string, unknown>) => ({
        usuario_id: String(row.usuario_id),
        empresa_id: String(row.empresa_id),
        rol: row.rol as RolEmpresa,
        empresa: row.empresa as Empresa | undefined,
      }));
      setMembresias(lista);
      try {
        localStorage.setItem(
          STORAGE_MEMBRESIAS_CACHE_KEY,
          JSON.stringify({ userId, lista })
        );
      } catch {
        // Ignorar si almacenamiento está lleno
      }
      if (lista.length === 1) {
        setEmpresaActivaId(lista[0].empresa_id);
        localStorage.setItem(STORAGE_EMPRESA_KEY, lista[0].empresa_id);
      }
      return;
    }

    // Si está sin conexión al abrir la PWA, intentar recuperar membresías cacheadas del mismo usuario
    try {
      const raw = localStorage.getItem(STORAGE_MEMBRESIAS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          userId: string;
          lista: UsuarioEmpresa[];
        };
        if (parsed.userId === userId) {
          setMembresias(parsed.lista);
        }
      }
    } catch {
      // Sin caché válido
    }
  };

  useEffect(() => {
    let activo = true;

    const inicializar = async () => {
      if (isSupabaseConfigured && supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (activo && session?.user) {
          setUsuario({
            id: session.user.id,
            email: session.user.email ?? '',
            nombre:
              (session.user.user_metadata?.nombre as string) ??
              session.user.email ??
              'Usuario',
          });
          await cargarMembresiasSupabase(session.user.id);
        }
        if (activo) setCargando(false);
        return;
      }

      if (isDemoModeAllowed) {
        const demoActivo =
          localStorage.getItem(STORAGE_DEMO_AUTH_KEY) === 'true';
        if (activo && demoActivo) {
          setUsuario(USUARIO_DEMO);
          setMembresias(MEMBRESIAS_DEMO);
        }
      }
      if (activo) setCargando(false);
    };

    inicializar();
    return () => {
      activo = false;
    };
  }, []);

  const iniciarSesion = async (
    email: string,
    password: string
  ): Promise<{ error?: string }> => {
    if (!email.trim() || !password.trim()) {
      return { error: 'Ingresa tu correo electrónico y contraseña.' };
    }

    if (isSupabaseMissingInProd) {
      return {
        error:
          'Falta configurar las variables de Supabase (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY) para este entorno.',
      };
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.user) {
        return {
          error:
            error?.message === 'Invalid login credentials'
              ? 'Correo o contraseña incorrectos.'
              : error?.message ?? 'No se pudo iniciar sesión.',
        };
      }

      setUsuario({
        id: data.user.id,
        email: data.user.email ?? email,
        nombre:
          (data.user.user_metadata?.nombre as string) ??
          data.user.email ??
          'Usuario',
      });
      await cargarMembresiasSupabase(data.user.id);
      return {};
    }

    if (!isDemoModeAllowed) {
      return { error: 'El modo demostración no está habilitado.' };
    }

    localStorage.setItem(STORAGE_DEMO_AUTH_KEY, 'true');
    setUsuario({
      ...USUARIO_DEMO,
      email: email.trim(),
    });
    setMembresias(MEMBRESIAS_DEMO);
    return {};
  };

  const iniciarSesionDemo = () => {
    if (!isDemoModeAllowed) return;
    localStorage.setItem(STORAGE_DEMO_AUTH_KEY, 'true');
    setUsuario(USUARIO_DEMO);
    setMembresias(MEMBRESIAS_DEMO);
  };

  const seleccionarEmpresa = (empresaId: string) => {
    setEmpresaActivaId(empresaId);
    localStorage.setItem(STORAGE_EMPRESA_KEY, empresaId);
  };

  const cerrarSesion = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    try {
      await limpiarCacheAlCerrarSesion();
    } catch {
      // Ignorar si IndexedDB no está disponible
    }
    localStorage.removeItem(STORAGE_DEMO_AUTH_KEY);
    localStorage.removeItem(STORAGE_EMPRESA_KEY);
    localStorage.removeItem(STORAGE_MEMBRESIAS_CACHE_KEY);
    setUsuario(null);
    setMembresias([]);
    setEmpresaActivaId(null);
  };

  const membresiaActiva =
    membresias.find((m) => m.empresa_id === empresaActivaId) ?? null;

  return (
    <AuthContext.Provider
      value={{
        usuario,
        membresias,
        empresaActiva: membresiaActiva?.empresa ?? null,
        rolActivo: membresiaActiva?.rol ?? null,
        cargando,
        modoDemo: isDemoModeAllowed,
        errorConfiguracion: isSupabaseMissingInProd,
        iniciarSesion,
        iniciarSesionDemo,
        seleccionarEmpresa,
        cerrarSesion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider.');
  }
  return ctx;
}
