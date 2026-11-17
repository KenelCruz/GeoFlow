/**
 * Tipos de dominio para el módulo de OPERACIÓN de Cotizador de Levantamientos.
 * Este archivo no depende de React ni de ninguna librería de UI.
 */

export type RolEmpresa = 'admin' | 'coordinador' | 'tecnico';

export type CargoPersonal =
  | 'tecnico'
  | 'ingeniero'
  | 'jefe_brigada'
  | 'chofer';

export type EstadoVehiculo = 'disponible' | 'en_uso' | 'mantenimiento';

export type EstadoTrabajo =
  | 'cotizado'
  | 'aprobado'
  | 'programado'
  | 'en_campo'
  | 'procesando'
  | 'entregado'
  | 'cobrado';

export interface Empresa {
  id: string;
  nombre: string;
  rnc: string;
  logo_url?: string | null;
  zona_horaria: string;
}

export interface UsuarioEmpresa {
  usuario_id: string;
  empresa_id: string;
  rol: RolEmpresa;
  empresa?: Empresa;
}

export interface UsuarioSesion {
  id: string;
  email: string;
  nombre: string;
}

export interface Personal {
  id: string;
  empresa_id: string;
  nombre: string;
  cargo: CargoPersonal;
  telefono: string;
  activo: boolean;
}

export interface Vehiculo {
  id: string;
  empresa_id: string;
  nombre: string;
  tipo: string;
  combustible: string;
  rendimiento_km_gal: number;
  estado: EstadoVehiculo;
}

export interface Trabajo {
  id: string;
  empresa_id: string;
  cliente: string;
  contacto: string;
  ubicacion_texto: string;
  lat: number | null;
  lng: number | null;
  tipo_levantamiento: string;
  fecha_prevista: string; // Formato YYYY-MM-DD
  fecha_inicio_real: string | null;
  fecha_fin_real: string | null;
  estado: EstadoTrabajo;
  responsable_id: string | null;
}

export interface TrabajoPersonal {
  id: string;
  empresa_id: string;
  trabajo_id: string;
  personal_id: string;
  fecha: string; // Formato YYYY-MM-DD
}

export interface TrabajoVehiculo {
  id: string;
  empresa_id: string;
  trabajo_id: string;
  vehiculo_id: string;
  fecha: string; // Formato YYYY-MM-DD
}

export interface BitacoraEntrada {
  id: string;
  empresa_id: string;
  trabajo_id: string;
  autor_id: string;
  autor_nombre?: string;
  fecha_hora: string; // ISO 8601
  nota: string;
  foto_url: string | null; // Ruta en Storage ({empresa_id}/{trabajo_id}/{archivo}) o URL local en demo
  foto_preview_url?: string | null; // URL firmada temporal o ObjectURL/DataURL local para renderizado
  pendiente_sincronizar?: boolean;
}

export interface ConflictoAgenda {
  tipo: 'personal' | 'vehiculo';
  recurso_id: string;
  recurso_nombre: string;
  fecha: string;
  trabajo_conflicto_id: string;
  trabajo_conflicto_cliente: string;
}

export interface ColaSincronizacionItem {
  id: string;
  tipo: 'bitacora_crear';
  empresa_id: string;
  payload: BitacoraEntrada;
  foto_blob?: Blob | null;
  creado_en: string;
  intentos: number;
  ultimo_error?: string | null;
}
