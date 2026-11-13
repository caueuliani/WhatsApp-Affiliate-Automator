import { extractMercadoLivreOffers } from "../offers/mercadoLivre";

const DB_NAME = "affiliate-operator-shared-links";
const STORE = "pending";
const KEY = "latest";
const MAX_AGE_MS = 10 * 60 * 1000;

type PendingShare = { text: string; receivedAt: number };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Only the locally installed PWA can receive this. No affiliate link in URL or network logs. */
export async function consumeIncomingShare(): Promise<string | null> {
  const db = await openDb();
  try {
    const data = await new Promise<PendingShare | undefined>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      const get = store.get(KEY);
      get.onsuccess = () => {
        store.delete(KEY);
        resolve(get.result as PendingShare | undefined);
      };
      get.onerror = () => reject(get.error);
      transaction.onerror = () => reject(transaction.error);
    });
    if (!data || typeof data.text !== "string" || data.text.length > 12_000
      || !Number.isFinite(data.receivedAt) || Date.now() - data.receivedAt > MAX_AGE_MS
      || data.receivedAt > Date.now() + 60_000) return null;
    // Validate the shared content before adding it to the editor.
    try { extractMercadoLivreOffers(data.text); return data.text; }
    catch { return null; }
  } finally { db.close(); }
}
