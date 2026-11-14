import { test } from "node:test";
import { strict as assert } from "node:assert";
import worker, { runSchedule } from "../cloudflare/src/index.mjs";

const SECRET = "a".repeat(64);

test("endpoint do Worker nega acesso sem segredo", async () => {
  const fakeDb = { prepare() { throw new Error("Não deve acessar D1 sem auth."); } };
  const url = "https://worker.example/internal/state";
  const anon = await worker.fetch(new Request(url), { INTERNAL_API_TOKEN: SECRET, DB: fakeDb });
  assert.equal(anon.status, 401);
  const invalid = await worker.fetch(new Request(url, { headers: { authorization: "Bearer " + "x".repeat(64), "x-operator-uid": "uid1" } }), { INTERNAL_API_TOKEN: SECRET, DB: fakeDb });
  assert.equal(invalid.status, 401);
  const noUser = await worker.fetch(new Request(url, { headers: { authorization: "Bearer " + SECRET } }), { INTERNAL_API_TOKEN: SECRET, DB: fakeDb });
  assert.equal(noUser.status, 400);
});

test("Cron reexecutado não cria duplicata para mesma regra e dia", async () => {
  const rows = [{
    owner_uid: "uid1", rule_id: "rule1", offer_id: "offer1",
    weekdays_json: "[1,3,5]", local_time: "09:00", channel: "whatsapp", enabled: 1, payload_json: "{}",
  }];
  const keys = new Set<string>();
  const statements: Array<{ values: unknown[]; sql: string }> = [];
  const fakeDb = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          const statement = { sql, values };
          statements.push(statement);
          return {
            all: async () => ({ results: rows }),
            run: async () => {
              const id = values.slice(0, 3).join(":");
              const created = !keys.has(id);
              keys.add(id);
              return { meta: { changes: created ? 1 : 0 } };
            }
          };
        },
        all: async () => ({ results: rows })
      };
    },
    async batch(commands: Array<{ run(): Promise<{meta:{changes:number}}> }>) {
      return Promise.all(commands.map(command => command.run()));
    }
  };
  const now = new Date("2026-11-16T12:05:00Z"); // segunda, 09:05 BRT
  const first = await runSchedule(fakeDb, now);
  const second = await runSchedule(fakeDb, now);
  assert.equal(first.added, 1);
  assert.equal(second.added, 0);
  assert.equal(keys.size, 1);
  assert.equal(statements.filter(item => item.sql.includes("INSERT OR IGNORE")).length, 2);
});


test("D1 rejects unspecific revision before any database write", async () => {
  const db = { prepare() { throw new Error("A revisão é obrigatória antes do D1."); } };
  const response = await worker.fetch(new Request("https://worker.example/internal/state", {
    method: "PUT",
    headers: { authorization: "Bearer " + SECRET, "x-operator-uid": "uid1", "content-type": "application/json" },
    body: JSON.stringify({ offers: [], rules: [] }),
  }), { INTERNAL_API_TOKEN: SECRET, DB: db });
  assert.equal(response.status, 428);
});

test("D1 batch validates CAS claims and guards EVERY delete/insert with ownership nonce", async () => {
  const offer = {
    id: "offer1", title: "Promoção válida", message: "Publicidade: link afiliado",
    link: "https://meli.la/abc?tag=real", priceCents: null,
    plannedAt: null, createdAt: "2026-11-13T00:00:00Z", updatedAt: "2026-11-13T00:00:00Z",
  };
  const rule = {
    id: "rule1", offerId: "offer1", weekdays: [1], time: "10:00",
    channel: "whatsapp", enabled: true, destinationLabel: "Grupo",
    createdAt: "2026-11-13T00:00:00Z", updatedAt: "2026-11-13T00:00:00Z",
  };
  const submitted = JSON.stringify({ expectedRevision: 0, offers: [offer], rules: [rule] });
  const seen: Array<{ sql: string; args: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            sql, args,
            async first() { return { revision: 1 }; },
          };
        }
      };
    },
    async batch(statements: Array<{ sql: string; args: unknown[] }>) {
      seen.push(...statements);
      return statements.map((_, i) => ({ meta: { changes: i === 0 ? 1 : 0 } }));
    },
  };
  const request = () => new Request("https://worker.example/internal/state", {
    method: "PUT", headers: { authorization: "Bearer " + SECRET, "x-operator-uid": "uid1", "content-type": "application/json" },
    body: submitted,
  });
  const reply = await worker.fetch(request(), { INTERNAL_API_TOKEN: SECRET, DB: db });
  assert.equal(reply.status, 200);
  assert.deepEqual(await reply.json(), { ok: true, revision: 1 });
  assert.equal(seen.length, 6);
  assert.match(seen[0].sql, /INSERT OR IGNORE INTO operator_revisions/);
  assert.match(seen[1].sql, /UPDATE operator_revisions SET revision=revision\+1/);
  for (const command of seen.slice(2)) {
    assert.match(command.sql, /EXISTS \(SELECT 1 FROM operator_revisions WHERE owner_uid = \? AND write_token = \?\)/);
    assert.equal(command.args.at(-2), "uid1");
    assert.equal(typeof command.args.at(-1), "string");
  }
  const insertedLink = seen.find(s => s.sql.startsWith("INSERT INTO offers"))!;
  assert.match(String(insertedLink.args[2]), /meli\.la\/abc\?tag=real/);

  // A competing writer with stale base revision cannot claim or mutate rows.
  const staleDb = {
    ...db,
    async batch(statements: Array<{ sql: string; args: unknown[] }>) {
      assert.equal(statements.length, 6);
      return statements.map(() => ({ meta: { changes: 0 } }));
    },
  };
  const conflict = await worker.fetch(request(), { INTERNAL_API_TOKEN: SECRET, DB: staleDb });
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).currentRevision, 1);
});

test("first revision 0 and repeated revision 1 are validated as integers", async () => {
  const req = (revision: unknown) => new Request("https://worker.example/internal/state", {
    method: "PUT", headers: { authorization: "Bearer " + SECRET, "x-operator-uid": "uid1", "content-type": "application/json" },
    body: JSON.stringify({ expectedRevision: revision, offers: [], rules: [] }),
  });
  const db = { prepare() { throw new Error("Invalid revisions must not access D1."); } };
  for (const value of [-1, 1.2, "0", null, 2 ** 60]) {
    const response = await worker.fetch(req(value), { INTERNAL_API_TOKEN: SECRET, DB: db });
    assert.equal(response.status, 428);
  }
});
