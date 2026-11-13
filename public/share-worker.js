/* Share-target only: does not cache authenticated pages, requests, or secrets. */
const DB_NAME = "affiliate-operator-shared-links";
const STORE = "pending";
const KEY = "latest";
const MAX_TEXT = 12000;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function saveIncoming(text) {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put({ text, receivedAt: Date.now() }, KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || url.origin !== self.location.origin || url.pathname !== "/share-target") return;
  event.respondWith((async () => {
    try {
      const form = await event.request.formData();
      const parts = ["title", "text", "url"].map(key => form.get(key))
        .filter(value => typeof value === "string" && value.trim());
      const shared = [...new Set(parts)].join("\n").slice(0, MAX_TEXT);
      if (shared) await saveIncoming(shared);
    } catch { /* Invalid data should not leak to a server. */ }
    return Response.redirect(new URL("/?incoming-share=1", self.location.origin), 303);
  })());
});
