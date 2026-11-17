/**
 * Cliente de Supabase para autenticación, base de datos Postgres y Storage.
 * El modo demostración solo se permite en desarrollo local o si VITE_ENABLE_DEMO=true.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('tu-proyecto.supabase.co') &&
    !supabaseAnonKey.includes('tu-clave-anon-publica')
);

/** El modo demo nunca debe quedar activo automáticamente en producción sin bandera explícita */
export const isDemoModeAllowed =
  !isSupabaseConfigured &&
  (import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO === 'true');

/** Indica si falta la configuración de Supabase en un entorno de producción */
export const isSupabaseMissingInProd =
  !isSupabaseConfigured && !isDemoModeAllowed;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
