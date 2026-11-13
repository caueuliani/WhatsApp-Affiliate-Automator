/* Minimal PWA share target: intercept POST locally, never send affiliate links in URL or server logs.
   No application/API caching: authenticated responses must always be fetched from the network. */
const CACHE = "affiliate-operator-shares-v1";
const MAX_TEXT = 12_000;
const MAX_AGE_MS = 60 * 60 * 1000;
const CAPTURE_ROUTE = /^\/__shared\/([0-9a-f-]{36})$/i;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

function errorRedirect() {
  return Response.redirect(new URL("/?ml_share_error=invalid", self.location.origin).href, 303);
}
async function cleanOldShares(cache) {
  const keys = await cache.keys();
  const now = Date.now();
  for (const key of keys) {
    const response = await cache.match(key);
    if (!response) continue;
    const age = now - Number(response.headers.get("x-share-received-at"));
    if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) await cache.delete(key);
  }
}
async function capture(request) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) return errorRedirect();
  let form;
  try { form = await request.formData(); } catch { return errorRedirect(); }
  const title = form.get("title");
  const text = form.get("text");
  const url = form.get("url");
  if (![title, text, url].every(value => value === null || typeof value === "string")) return errorRedirect();
  const data = { title: title || "", text: text || "", url: url || "" };
  if (!Object.values(data).some(Boolean) || JSON.stringify(data).length > MAX_TEXT) return errorRedirect();
  const key = crypto.randomUUID();
  const cache = await caches.open(CACHE);
  await cleanOldShares(cache);
  await cache.put(new Request(new URL("/__shared/" + key, self.location.origin)), new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-share-received-at": String(Date.now()),
      "x-content-type-options": "nosniff",
    },
  }));
  // Only random handle is in navigation URL, never the original affiliate link or referral.
  return Response.redirect(new URL("/?ml_share=" + encodeURIComponent(key), self.location.origin).href, 303);
}
async function release(request) {
  const match = CAPTURE_ROUTE.exec(new URL(request.url).pathname);
  if (!match) return new Response(null, { status: 404 });
  const cache = await caches.open(CACHE);
  const response = await cache.match(request);
  if (!response) return new Response(JSON.stringify({ error: "Compartilhamento não encontrado ou expirado." }), {
    status: 404, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
  await cache.delete(request);
  const age = Date.now() - Number(response.headers.get("x-share-received-at"));
  if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) return new Response(null, { status: 410 });
  return new Response(await response.text(), {
    status: 200, headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/share-target" && event.request.method === "POST") {
    event.respondWith(capture(event.request).catch(errorRedirect));
  } else if (event.request.method === "GET" && CAPTURE_ROUTE.test(url.pathname)) {
    event.respondWith(release(event.request));
  }
});
