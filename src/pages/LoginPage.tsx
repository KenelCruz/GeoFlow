/**
 * Pantalla de inicio de sesión con correo y contraseña.
 * Bloquea el acceso si faltan credenciales de Supabase en producción; solo habilita demo cuando está permitido.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Compass,
  Eye,
  EyeOff,
  Lock,
  Mail,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export const LoginPage: React.FC = () => {
  const {
    iniciarSesion,
    iniciarSesionDemo,
    modoDemo,
    errorConfiguracion,
  } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState(
    modoDemo ? 'coordinador@ejemplo-ficticio.do' : ''
  );
  const [password, setPassword] = useState(modoDemo ? 'demo1234' : '');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const res = await iniciarSesion(email, password);
    setEnviando(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    navigate('/seleccionar-empresa');
  };

  const handleAccesoDemo = () => {
    iniciarSesionDemo();
    navigate('/seleccionar-empresa');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8 sm:px-6">
      <div className="grid w-full max-w-4xl items-stretch overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:grid-cols-2">
        {/* Panel editorial / contexto operativo en escritorio y tablet */}
        <section className="hidden md:flex md:flex-col md:justify-between md:bg-slate-900 md:p-8 md:text-white">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                <Compass className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold tracking-tight text-white">
                Cotizador de Levantamientos
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="text-2xl font-bold leading-tight tracking-tight text-white lg:text-3xl [text-wrap:balance]">
                Operación diaria para brigadas topográficas
              </h1>
              <p className="text-sm leading-relaxed text-slate-300">
                Coordina levantamientos, asignaciones sin solapamientos y
                bitácoras fotográficas de campo con respaldo sin conexión.
              </p>
            </div>
          </div>

          <dl className="divide-y divide-slate-800 border-t border-slate-800 pt-4 text-xs">
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-slate-400">Agenda operativa</dt>
              <dd className="font-medium text-slate-100">
                Detección de conflictos
              </dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-slate-400">Bitácora de campo</dt>
              <dd className="font-medium text-slate-100">
                Notas y fotos offline
              </dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-slate-400">Seguridad</dt>
              <dd className="font-medium text-slate-100">
                Multi-empresa por roles
              </dd>
            </div>
          </dl>
        </section>

        {/* Formulario de acceso */}
        <section className="flex flex-col justify-center p-6 sm:p-8">
          <div className="mb-6 md:hidden">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-emerald-400">
              <Compass className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Cotizador de Levantamientos
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              Módulo de operación para brigadas topográficas
            </p>
          </div>

          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">Iniciar sesión</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Ingresa con tu correo corporativo asignado
            </p>
          </div>

          {errorConfiguracion && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <span>
                Falta configurar <strong>VITE_SUPABASE_URL</strong> y{' '}
                <strong>VITE_SUPABASE_ANON_KEY</strong> en este entorno de
                producción.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700"
              >
                Correo electrónico
              </label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@empresa.do"
                  className="min-h-[46px] w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700"
              >
                Contraseña
              </label>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={mostrarPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="min-h-[46px] w-full rounded-xl border border-slate-300 bg-white pl-10 pr-12 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword((v) => !v)}
                  className="absolute right-1.5 top-1/2 flex min-h-[38px] min-w-[38px] -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label={
                    mostrarPassword
                      ? 'Ocultar contraseña'
                      : 'Mostrar contraseña'
                  }
                >
                  {mostrarPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={enviando || errorConfiguracion}
              className="min-h-[48px] w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
            >
              {enviando ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </form>

          {modoDemo && (
            <div className="mt-5 border-t border-slate-100 pt-5">
              <p className="mb-3 text-xs text-slate-500">
                Entorno de desarrollo sin Supabase configurado. Puedes probar la
                aplicación con datos ficticios de demostración.
              </p>
              <button
                type="button"
                onClick={handleAccesoDemo}
                className="min-h-[46px] w-full rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
              >
                Entrar en modo demostración
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
