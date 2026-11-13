import { test } from "node:test";
import { strict as assert } from "node:assert";
import { saoPauloClock, ruleIsDue, jobIdentity } from "../cloudflare/src/scheduler.mjs";

test("Cron UTC convertido ao dia local de São Paulo", () => {
  const now = new Date("2026-11-16T11:30:00Z");
  assert.deepEqual(saoPauloClock(now), { weekday: 1, localDate: "2026-11-16", localTime: "08:30" });
});

test("só gera revisão quando dia e horário já chegaram", () => {
  const clock = saoPauloClock(new Date("2026-11-16T12:03:00Z"));
  const rule = { enabled: 1, weekdays_json: "[1,3,5]", local_time: "09:00" };
  assert.equal(ruleIsDue(rule, clock), true);
  assert.equal(ruleIsDue({ ...rule, local_time: "09:05" }, clock), false);
  assert.equal(ruleIsDue({ ...rule, weekdays_json: "[2,4]" }, clock), false);
  assert.equal(ruleIsDue({ ...rule, enabled: 0 }, clock), false);
});

test("chave idempotente por operador, regra e dia", () => {
  const clock = saoPauloClock(new Date("2026-11-16T14:30:00Z"));
  const rule = { owner_uid: "operator", rule_id: "weekly-123" };
  assert.equal(jobIdentity(rule, clock), "operator:weekly-123:2026-11-16");
});
