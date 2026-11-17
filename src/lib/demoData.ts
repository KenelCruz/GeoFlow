/**
 * DATOS FICTICIOS DE DEMOSTRACIÓN (no corresponden a clientes ni empresas reales).
 * Se utilizan cuando Supabase no está configurado, para poder probar toda la app de inmediato.
 */
import { obtenerFechaHoyISO } from '../domain/formatters';
import type {
  BitacoraEntrada,
  Empresa,
  Personal,
  Trabajo,
  TrabajoPersonal,
  TrabajoVehiculo,
  UsuarioEmpresa,
  UsuarioSesion,
  Vehiculo,
} from '../domain/types';

const hoy = obtenerFechaHoyISO();

function sumarDias(fechaISO: string, dias: number): string {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const f = new Date(y, m - 1, d + dias);
  const ay = f.getFullYear();
  const am = String(f.getMonth() + 1).padStart(2, '0');
  const ad = String(f.getDate()).padStart(2, '0');
  return `${ay}-${am}-${ad}`;
}

export const USUARIO_DEMO: UsuarioSesion = {
  id: 'usr-demo-001',
  email: 'coordinador@ejemplo-ficticio.do',
  nombre: 'Ing. Marcos Polanco (Demo)',
};

export const EMPRESAS_DEMO: Empresa[] = [
  {
    id: 'emp-demo-001',
    nombre: 'Topografía Caribe Ficticia SRL',
    rnc: '1-31-00001-1',
    zona_horaria: 'America/Santo_Domingo',
  },
  {
    id: 'emp-demo-002',
    nombre: 'Geodesia Cibao Demo EIRL',
    rnc: '1-32-00002-2',
    zona_horaria: 'America/Santo_Domingo',
  },
];

export const MEMBRESIAS_DEMO: UsuarioEmpresa[] = [
  {
    usuario_id: USUARIO_DEMO.id,
    empresa_id: EMPRESAS_DEMO[0].id,
    rol: 'admin',
    empresa: EMPRESAS_DEMO[0],
  },
  {
    usuario_id: USUARIO_DEMO.id,
    empresa_id: EMPRESAS_DEMO[1].id,
    rol: 'coordinador',
    empresa: EMPRESAS_DEMO[1],
  },
];

export const PERSONAL_DEMO: Personal[] = [
  {
    id: 'per-001',
    empresa_id: 'emp-demo-001',
    nombre: 'Luis Alcántara (Ficticio)',
    cargo: 'jefe_brigada',
    telefono: '809-555-0141',
    activo: true,
  },
  {
    id: 'per-002',
    empresa_id: 'emp-demo-001',
    nombre: 'Rosaura Mejía (Ficticio)',
    cargo: 'ingeniero',
    telefono: '829-555-0182',
    activo: true,
  },
  {
    id: 'per-003',
    empresa_id: 'emp-demo-001',
    nombre: 'Kelvin Rosario (Ficticio)',
    cargo: 'tecnico',
    telefono: '849-555-0193',
    activo: true,
  },
  {
    id: 'per-004',
    empresa_id: 'emp-demo-001',
    nombre: 'Ramón Tejeda (Ficticio)',
    cargo: 'chofer',
    telefono: '809-555-0164',
    activo: true,
  },
  {
    id: 'per-005',
    empresa_id: 'emp-demo-002',
    nombre: 'Paola Domínguez (Ficticio)',
    cargo: 'ingeniero',
    telefono: '809-555-0211',
    activo: true,
  },
];

export const VEHICULOS_DEMO: Vehiculo[] = [
  {
    id: 'veh-001',
    empresa_id: 'emp-demo-001',
    nombre: 'Hilux 4x4 Blanca #01',
    tipo: 'Camioneta 4x4',
    combustible: 'Gasoil',
    rendimiento_km_gal: 32,
    estado: 'en_uso',
  },
  {
    id: 'veh-002',
    empresa_id: 'emp-demo-001',
    nombre: 'Frontier Gris #02',
    tipo: 'Camioneta 4x4',
    combustible: 'Gasoil',
    rendimiento_km_gal: 30,
    estado: 'disponible',
  },
  {
    id: 'veh-003',
    empresa_id: 'emp-demo-001',
    nombre: 'Jimny Campo #03',
    tipo: 'Todo terreno compacto',
    combustible: 'Gasolina Premium',
    rendimiento_km_gal: 38,
    estado: 'mantenimiento',
  },
  {
    id: 'veh-004',
    empresa_id: 'emp-demo-002',
    nombre: 'L200 Azul #01',
    tipo: 'Camioneta 4x4',
    combustible: 'Gasoil',
    rendimiento_km_gal: 31,
    estado: 'disponible',
  },
];

export const TRABAJOS_DEMO: Trabajo[] = [
  {
    id: 'trb-001',
    empresa_id: 'emp-demo-001',
    cliente: 'Inversiones Palma Real (Ficticio)',
    contacto: '809-555-3100 · Arq. Laura Gómez',
    ubicacion_texto: 'Bávaro, Verón - Parcela 14-B (Ejemplo)',
    lat: 18.6813,
    lng: -68.4543,
    tipo_levantamiento: 'Deslinde y subdivisión',
    fecha_prevista: hoy,
    fecha_inicio_real: new Date().toISOString(),
    fecha_fin_real: null,
    estado: 'en_campo',
    responsable_id: 'per-001',
  },
  {
    id: 'trb-002',
    empresa_id: 'emp-demo-001',
    cliente: 'Constructora Valle Verde (Ficticio)',
    contacto: '829-555-4200 · Ing. Pedro Núñez',
    ubicacion_texto: 'Jarabacoa, La Vega - Carretera El Salto (Ejemplo)',
    lat: 19.1168,
    lng: -70.6359,
    tipo_levantamiento: 'Levantamiento topográfico con curvas de nivel',
    fecha_prevista: hoy,
    fecha_inicio_real: null,
    fecha_fin_real: null,
    estado: 'programado',
    responsable_id: 'per-002',
  },
  {
    id: 'trb-003',
    empresa_id: 'emp-demo-001',
    cliente: 'Agropecuaria del Este (Ficticio)',
    contacto: '809-555-5300 · Sr. Héctor Sosa',
    ubicacion_texto: 'Higüey, La Altagracia - Finca San Isidro (Ejemplo)',
    lat: null,
    lng: null,
    tipo_levantamiento: 'Replanteo de linderos',
    fecha_prevista: sumarDias(hoy, 1),
    fecha_inicio_real: null,
    fecha_fin_real: null,
    estado: 'aprobado',
    responsable_id: 'per-001',
  },
  {
    id: 'trb-004',
    empresa_id: 'emp-demo-001',
    cliente: 'Residencial Brisas del Mar (Ficticio)',
    contacto: '849-555-6400 · Lic. Carmen Díaz',
    ubicacion_texto: 'Boca Chica, Santo Domingo Este (Ejemplo)',
    lat: null,
    lng: null,
    tipo_levantamiento: 'Actualización parcelaria',
    fecha_prevista: sumarDias(hoy, -1),
    fecha_inicio_real: null,
    fecha_fin_real: null,
    estado: 'procesando',
    responsable_id: 'per-002',
  },
  {
    id: 'trb-005',
    empresa_id: 'emp-demo-002',
    cliente: 'Proyectos Cibao Central (Ficticio)',
    contacto: '809-555-7500 · Ing. Joel Batista',
    ubicacion_texto: 'Santiago Oeste, Cienfuegos (Ejemplo)',
    lat: null,
    lng: null,
    tipo_levantamiento: 'Deslinde',
    fecha_prevista: hoy,
    fecha_inicio_real: null,
    fecha_fin_real: null,
    estado: 'programado',
    responsable_id: 'per-005',
  },
];

export const ASIGNACIONES_PERSONAL_DEMO: TrabajoPersonal[] = [
  {
    id: 'ap-001',
    empresa_id: 'emp-demo-001',
    trabajo_id: 'trb-001',
    personal_id: 'per-001',
    fecha: hoy,
  },
  {
    id: 'ap-002',
    empresa_id: 'emp-demo-001',
    trabajo_id: 'trb-001',
    personal_id: 'per-003',
    fecha: hoy,
  },
  {
    id: 'ap-003',
    empresa_id: 'emp-demo-001',
    trabajo_id: 'trb-002',
    personal_id: 'per-002',
    fecha: hoy,
  },
  {
    id: 'ap-004',
    empresa_id: 'emp-demo-002',
    trabajo_id: 'trb-005',
    personal_id: 'per-005',
    fecha: hoy,
  },
];

export const ASIGNACIONES_VEHICULO_DEMO: TrabajoVehiculo[] = [
  {
    id: 'av-001',
    empresa_id: 'emp-demo-001',
    trabajo_id: 'trb-001',
    vehiculo_id: 'veh-001',
    fecha: hoy,
  },
  {
    id: 'av-002',
    empresa_id: 'emp-demo-002',
    trabajo_id: 'trb-005',
    vehiculo_id: 'veh-004',
    fecha: hoy,
  },
];

export const BITACORA_DEMO: BitacoraEntrada[] = [
  {
    id: 'bit-001',
    empresa_id: 'emp-demo-001',
    trabajo_id: 'trb-001',
    autor_id: USUARIO_DEMO.id,
    autor_nombre: 'Luis Alcántara (Ficticio)',
    fecha_hora: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    nota: 'Base RTK instalada en vértice norte. Buena señal satelital (18 satélites fijos). Se inicia levantamiento de linderos.',
    foto_url: null,
    pendiente_sincronizar: false,
  },
  {
    id: 'bit-002',
    empresa_id: 'emp-demo-001',
    trabajo_id: 'trb-001',
    autor_id: USUARIO_DEMO.id,
    autor_nombre: 'Kelvin Rosario (Ficticio)',
    fecha_hora: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    nota: 'Se verificó colindancia este con muro existente. Faltan 4 mojones del lindero sur por despejar maleza.',
    foto_url: null,
    pendiente_sincronizar: false,
  },
];
