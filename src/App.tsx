/**
 * Enrutamiento principal con protección por autenticación y empresa activa (multi-tenant).
 */
import React from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { OperacionProvider } from './hooks/useOperacionData';
import { AgendaPage } from './pages/AgendaPage';
import { BitacoraPage } from './pages/BitacoraPage';
import { LoginPage } from './pages/LoginPage';
import { PersonalPage } from './pages/PersonalPage';
import { SeleccionEmpresaPage } from './pages/SeleccionEmpresaPage';
import { TrabajoDetallePage } from './pages/TrabajoDetallePage';
import { TrabajosPage } from './pages/TrabajosPage';
import { VehiculosPage } from './pages/VehiculosPage';

const RutaAutenticada: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { usuario, cargando } = useAuth();
  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Cargando sesión...
      </div>
    );
  }
  if (!usuario) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const RutaConEmpresa: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { usuario, empresaActiva, cargando } = useAuth();
  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Cargando empresa...
      </div>
    );
  }
  if (!usuario) {
    return <Navigate to="/login" replace />;
  }
  if (!empresaActiva) {
    return <Navigate to="/seleccionar-empresa" replace />;
  }
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <OperacionProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/seleccionar-empresa"
              element={
                <RutaAutenticada>
                  <SeleccionEmpresaPage />
                </RutaAutenticada>
              }
            />
            <Route
              element={
                <RutaConEmpresa>
                  <Layout />
                </RutaConEmpresa>
              }
            >
              <Route path="/trabajos" element={<TrabajosPage />} />
              <Route path="/trabajos/:id" element={<TrabajoDetallePage />} />
              <Route path="/trabajos/:id/bitacora" element={<BitacoraPage />} />
              <Route path="/agenda" element={<AgendaPage />} />
              <Route path="/personal" element={<PersonalPage />} />
              <Route path="/vehiculos" element={<VehiculosPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/trabajos" replace />} />
          </Routes>
        </BrowserRouter>
      </OperacionProvider>
    </AuthProvider>
  );
}
