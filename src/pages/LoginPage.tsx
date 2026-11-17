/**
 * Pantalla de inicio de sesión con correo y contraseña.
 * Bloquea el acceso si faltan credenciales de Supabase en producción; solo habilita demo cuando está permitido.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Compass, Lock, Mail } from 'lucide-react';
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
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-emerald-400">
            <Compass className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Cotizador de Levantamientos
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Módulo de operación para brigadas topográficas
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
                  className="min-h-[46px] w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
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
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="min-h-[46px] w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
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
        </div>
      </div>
    </div>
  );
};
