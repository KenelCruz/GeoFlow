/**
 * Persistencia local en IndexedDB para la bitácora de campo sin conexión
 * y la cola de sincronización automática al recuperar señal.
 */
import type { BitacoraEntrada, ColaSincronizacionItem } from '../domain/types';

const DB_NAME = 'cotizador_levantamientos_offline';
const DB_VERSION = 1;
const STORE_BITACORA = 'bitacora_local';
const STORE_COLA = 'cola_sincronizacion';

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
    };

    request.onsuccess = () => resolve(request.result);
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

/** Encola una entrada de bitácora para sincronizar cuando vuelva la conexión */
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
