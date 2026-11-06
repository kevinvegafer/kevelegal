// Archivos del modo demostración: se guardan en IndexedDB de este navegador.
const DB_NAME = "kevelegal-demo-archivos";
const STORE = "archivos";
export const MAX_ARCHIVO = 50 * 1024 * 1024;

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, modo);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(r ? r.result : undefined);
    t.onerror = () => reject(t.error);
  });
}

export async function guardarArchivo(path: string, blob: Blob) {
  if (blob.size > MAX_ARCHIVO) throw new Error("El archivo supera 50 MB");
  await tx("readwrite", (s) => s.put(blob, path));
}
export async function leerArchivo(path: string): Promise<Blob | null> {
  return ((await tx<Blob>("readonly", (s) => s.get(path))) as Blob | undefined) ?? null;
}
export async function borrarArchivos(paths: string[]) {
  await tx("readwrite", (s) => { for (const p of paths) s.delete(p); });
}
export async function borrarTodo() {
  try { await tx("readwrite", (s) => { s.clear(); }); } catch { /* ignore */ }
}
