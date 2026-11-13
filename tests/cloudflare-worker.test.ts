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
