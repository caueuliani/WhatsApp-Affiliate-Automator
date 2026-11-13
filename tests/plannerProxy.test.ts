import { test } from "node:test";
import { strict as assert } from "node:assert";
import { proxyPlannerRequest } from "../src/server/plannerProxy";

test("não conecta Worker sem token, URL HTTPS e UID válido", async () => {
  const run = (cfg: {url?: string;token?:string},uid="uid") =>
    proxyPlannerRequest(cfg,uid,"GET","/internal/state",undefined,async () => {throw Error("não deveria chamar");});
  await assert.rejects(run({ url: "https://example.workers.dev/", token: "" }));
  await assert.rejects(run({ url: "http://example.workers.dev/", token: "a".repeat(32) }));
  await assert.rejects(run({ url: "https://example.workers.dev/", token: "a".repeat(32) },"bad/user"));
});

test("não permite usar caminhos arbitrários ou SSRF por parâmetros do usuário", async () => {
  await assert.rejects(proxyPlannerRequest({ url: "https://example.workers.dev/", token: "a".repeat(32) }, "uid", "GET", "/internal/admin"));
});

test("encaminha UID verificado e segredo apenas para Worker HTTPS", async () => {
  let observed = false;
  const fakeFetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    assert.equal(String(input), "https://example.workers.dev/internal/state");
    assert.equal(init?.method, "PUT");
    assert.equal((init?.headers as Record<string,string>)["X-Operator-Uid"], "uid123");
    assert.equal((init?.headers as Record<string,string>).Authorization, "Bearer " + "S".repeat(40));
    observed = true;
    return new Response(JSON.stringify({ ok: true, revision: 1 }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  const result = await proxyPlannerRequest({ url: "https://example.workers.dev/", token: "S".repeat(40) }, "uid123", "PUT", "/internal/state", { offers: [], rules: [] }, fakeFetch);
  assert.equal(observed, true);
  assert.deepEqual(result, { status: 200, body: { ok: true, revision: 1 } });
});
