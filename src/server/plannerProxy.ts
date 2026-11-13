/**
 * Confere configuração e encapsula o acesso do backend Render ao Cloudflare Worker.
 * Nunca disponibilizar o INTERNAL_API_TOKEN ao frontend.
 */
export type PlannerProxyConfig = { url?: string; token?: string };
export type PlannerReply = { status: number; body: unknown };
const ALLOWED: Record<string, string[]> = {
  GET: ["/internal/state", "/internal/jobs"],
  PUT: ["/internal/state"],
  POST: ["/internal/jobs/mark"],
};
export async function proxyPlannerRequest(
  config: PlannerProxyConfig,
  uid: string,
  method: "GET" | "PUT" | "POST",
  endpoint: string,
  payload?: unknown,
  request: typeof fetch = fetch
): Promise<PlannerReply> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error("Invalid UID.");
  if (!ALLOWED[method]?.includes(endpoint)) throw new Error("Endpoint not permitted.");
  if (!config.url || !config.token || config.token.length < 32) throw new Error("Worker not configured.");
  let base: URL;
  try {
    base = new URL(config.url);
    if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash || base.pathname !== "/") {
      throw new Error("Invalid upstream URL.");
    }
  } catch { throw new Error("Invalid Worker URL."); }
  const target = new URL(endpoint, base);
  const headers: Record<string, string> = {
    Authorization: "Bearer " + config.token,
    "X-Operator-Uid": uid,
    Accept: "application/json",
  };
  if (method !== "GET") headers["Content-Type"] = "application/json";
  const response = await request(target, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(payload ?? {}),
    signal: AbortSignal.timeout(10_000),
    redirect: "error",
  });
  const content = await response.json().catch(() => ({ error: "Resposta inválida do agendador." }));
  return { status: response.status, body: content };
}
