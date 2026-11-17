/**
 * Contexto de autenticación y selección de empresa activa (multi-tenant).
 * Soporta Supabase Auth real y modo demostración local cuando no hay credenciales configuradas.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import type {
  Empresa,
  RolEmpresa,
  UsuarioEmpresa,
  UsuarioSesion,
} from '../domain/types';
import { MEMBRESIAS_DEMO, USUARIO_DEMO } from '../lib/demoData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

interface AuthContextValue {
  usuario: UsuarioSesion | null;
  membresias: UsuarioEmpresa[];
  empresaActiva: Empresa | null;
  rolActivo: RolEmpresa | null;
  cargando: boolean;
  modoDemo: boolean;
  iniciarSesion: (email: string, password: string) => Promise<{ error?: string }>;
  iniciarSesionDemo: () => void;
  seleccionarEmpresa: (empresaId: string) => void;
  cerrarSesion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_EMPRESA_KEY = 'cotizador_empresa_activa_id';
const STORAGE_DEMO_AUTH_KEY = 'cotizador_demo_autenticado';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [membresias, setMembresias] = useState<UsuarioEmpresa[]>([]);
  const [empresaActivaId, setEmpresaActivaId] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_EMPRESA_KEY)
  );
  const [cargando, setCargando] = useState(true);

  // Carga las empresas a las que pertenece el usuario desde Supabase
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
      if (lista.length === 1) {
        setEmpresaActivaId(lista[0].empresa_id);
        localStorage.setItem(STORAGE_EMPRESA_KEY, lista[0].empresa_id);
      }
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

      // Modo demostración local
      const demoActivo = localStorage.getItem(STORAGE_DEMO_AUTH_KEY) === 'true';
      if (activo && demoActivo) {
        setUsuario(USUARIO_DEMO);
        setMembresias(MEMBRESIAS_DEMO);
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

    // En modo demo, permite iniciar con cualquier correo/contraseña válida
    localStorage.setItem(STORAGE_DEMO_AUTH_KEY, 'true');
    setUsuario({
      ...USUARIO_DEMO,
      email: email.trim(),
    });
    setMembresias(MEMBRESIAS_DEMO);
    return {};
  };

  const iniciarSesionDemo = () => {
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
    localStorage.removeItem(STORAGE_DEMO_AUTH_KEY);
    localStorage.removeItem(STORAGE_EMPRESA_KEY);
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
        modoDemo: !isSupabaseConfigured,
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
