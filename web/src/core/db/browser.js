import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';
import { Database } from './database.js';

const DB_NAME = 'yt-playlist-manager';
const STORE = 'files';
const KEY = 'main.sqlite';

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbRequest(mode, fn) {
  return openIdb().then(
    (idb) =>
      new Promise((resolve, reject) => {
        const tx = idb.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => {
          idb.close();
          resolve(req.result);
        };
        tx.onerror = tx.onabort = () => {
          idb.close();
          reject(tx.error);
        };
      }),
  );
}

/** Stores the SQLite file as a single blob in IndexedDB. */
export const indexedDbPersistence = {
  load: () => idbRequest('readonly', (s) => s.get(KEY)),
  save: (bytes) => idbRequest('readwrite', (s) => s.put(bytes, KEY)),
};

let sqlPromise;
function loadSql() {
  sqlPromise ??= initSqlJs({ locateFile: () => wasmUrl });
  return sqlPromise;
}

/** Opens the app database, restoring the last saved copy from IndexedDB. */
export async function openBrowserDatabase() {
  const SQL = await loadSql();
  const saved = await indexedDbPersistence.load();
  const sqlDb = saved ? new SQL.Database(new Uint8Array(saved)) : new SQL.Database();
  const db = new Database(sqlDb, indexedDbPersistence);

  // Save right away when the tab is hidden or closed.
  const flush = () => db.flush().catch(() => {});
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  if (!saved) await db.flush();

  /** Re-reads the copy in IndexedDB (written by another tab). */
  db.reload = async () => {
    const bytes = await indexedDbPersistence.load();
    if (bytes) db.replace(new SQL.Database(new Uint8Array(bytes)));
  };
  return db;
}
