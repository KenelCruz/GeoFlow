/**
 * Persistencia local en IndexedDB:
 * - Caché operativo por empresa (trabajos, personal, vehículos y asignaciones) para trabajar sin señal.
 * - Entradas de bitácora locales y cola de sincronización con soporte de Blob fotográfico y reintentos.
 */
import type {
  BitacoraEntrada,
  ColaSincronizacionItem,
  Personal,
  Trabajo,
  TrabajoPersonal,
  TrabajoVehiculo,
  Vehiculo,
} from '../domain/types';

const DB_NAME = 'cotizador_levantamientos_offline';
const DB_VERSION = 2;
const STORE_BITACORA = 'bitacora_local';
const STORE_COLA = 'cola_sincronizacion';
const STORE_CACHE = 'cache_operacion';

export interface CacheOperacionEmpresa {
  empresa_id: string;
  trabajos: Trabajo[];
  personal: Personal[];
  vehiculos: Vehiculo[];
  asignacionesPersonal: TrabajoPersonal[];
  asignacionesVehiculo: TrabajoVehiculo[];
  actualizado_en: string;
}

function abrirBaseDatos(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no está disponible en este navegador.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_BITACORA)) {
        const store = db.createObjectStore(STORE_BITACORA, { keyPath: 'id' });
        store.createIndex('empresa_trabajo', ['empresa_id', 'trabajo_id'], {
          unique: false,
        });
      }
      if (!db.objectStoreNames.contains(STORE_COLA)) {
        db.createObjectStore(STORE_COLA, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: 'empresa_id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Guarda el snapshot operativo de una empresa para lectura sin conexión */
export async function guardarCacheOperacion(
  snapshot: CacheOperacionEmpresa
): Promise<void> {
  const db = await abrirBaseDatos();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CACHE, 'readwrite');
    tx.objectStore(STORE_CACHE).put(snapshot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Recupera el snapshot operativo guardado en caché para una empresa */
export async function obtenerCacheOperacion(
  empresaId: string
): Promise<CacheOperacionEmpresa | null> {
  const db = await abrirBaseDatos();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CACHE, 'readonly');
    const request = tx.objectStore(STORE_CACHE).get(empresaId);
    request.onsuccess = () =>
      resolve((request.result as CacheOperacionEmpresa | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

/** Guarda o actualiza una entrada de bitácora en IndexedDB */
export async function guardarBitacoraLocal(
  entrada: BitacoraEntrada
): Promise<void> {
  const db = await abrirBaseDatos();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BITACORA, 'readwrite');
    tx.objectStore(STORE_BITACORA).put(entrada);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Obtiene todas las entradas de bitácora locales de una empresa */
export async function obtenerBitacoraLocalPorEmpresa(
  empresaId: string
): Promise<BitacoraEntrada[]> {
  const db = await abrirBaseDatos();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BITACORA, 'readonly');
    const request = tx.objectStore(STORE_BITACORA).getAll();
    request.onsuccess = () => {
      const todas = (request.result as BitacoraEntrada[]) ?? [];
      resolve(todas.filter((item) => item.empresa_id === empresaId));
    };
    request.onerror = () => reject(request.error);
  });
}

/** Encola o actualiza una entrada de bitácora para sincronizar cuando vuelva la conexión */
export async function encolarSincronizacion(
  item: ColaSincronizacionItem
): Promise<void> {
  const db = await abrirBaseDatos();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_COLA, 'readwrite');
    tx.objectStore(STORE_COLA).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Obtiene todos los elementos pendientes en la cola de sincronización */
export async function obtenerColaSincronizacion(): Promise<
  ColaSincronizacionItem[]
> {
  const db = await abrirBaseDatos();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_COLA, 'readonly');
    const request = tx.objectStore(STORE_COLA).getAll();
    request.onsuccess = () =>
      resolve((request.result as ColaSincronizacionItem[]) ?? []);
    request.onerror = () => reject(request.error);
  });
}

/** Elimina un elemento de la cola tras sincronizarlo con éxito */
export async function eliminarDeColaSincronizacion(id: string): Promise<void> {
  const db = await abrirBaseDatos();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_COLA, 'readwrite');
    tx.objectStore(STORE_COLA).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Limpia el caché operativo y entradas ya sincronizadas al cerrar sesión,
 * conservando únicamente las entradas con sincronización pendiente para evitar pérdida de datos.
 */
export async function limpiarCacheAlCerrarSesion(): Promise<void> {
  const db = await abrirBaseDatos();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_CACHE, STORE_BITACORA], 'readwrite');
    tx.objectStore(STORE_CACHE).clear();
    const bitacoraStore = tx.objectStore(STORE_BITACORA);
    const req = bitacoraStore.getAll();
    req.onsuccess = () => {
      const todas = (req.result as BitacoraEntrada[]) ?? [];
      for (const item of todas) {
        if (!item.pendiente_sincronizar) {
          bitacoraStore.delete(item.id);
        }
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
