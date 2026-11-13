import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createDraft } from "../src/offers/library";
import { createWeeklyRule, exportWeeklyRules, parseWeeklyRules, upcomingOccurrences } from "../src/schedule/weekly";

const cut = createDraft({ title: "Cortador de grama", message: "Oferta de jardim", link: "https://exemplo.com/c", price: "", plannedAt: "" }, "c");
const shave = createDraft({ title: "Barbeador", message: "Oferta de beleza", link: "https://exemplo.com/b", price: "", plannedAt: "" }, "b");

test("exemplo hipotético: cortador seg/qua/sex, barbeador ter/qui", () => {
  const cutRule = createWeeklyRule({ offerId: "c", weekdays: [1, 3, 5], time: "09:00", channel: "whatsapp", destinationLabel: "Grupo público autorizado" }, ["c", "b"], "rule-c");
  const shaveRule = createWeeklyRule({ offerId: "b", weekdays: [2, 4], time: "10:30", channel: "instagram", destinationLabel: "@perfil-profissional" }, ["c", "b"], "rule-b");
  // 2026-11-16 é segunda-feira; aqui o horário tem interpretação de São Paulo.
  const results = upcomingOccurrences([cutRule, shaveRule], [cut, shave], new Date("2026-11-16T11:30:00Z"), 7);
  assert.deepEqual(results.map(r => [r.date, r.offerId, r.time, r.channel]), [
    ["2026-11-16", "c", "09:00", "whatsapp"],
    ["2026-11-17", "b", "10:30", "instagram"],
    ["2026-11-18", "c", "09:00", "whatsapp"],
    ["2026-11-19", "b", "10:30", "instagram"],
    ["2026-11-20", "c", "09:00", "whatsapp"],
  ]);
  assert.equal(results[0].due, false);
});

test("regra valida hora, dia, canal e existência de oferta", () => {
  const input = { offerId: "c", weekdays: [1, 1] as (0|1|2|3|4|5|6)[], time: "09:00", channel: "whatsapp" as const, destinationLabel: "" };
  assert.throws(() => createWeeklyRule(input, ["c"], "id"));
  assert.throws(() => createWeeklyRule({ ...input, weekdays: [1], time: "25:00" }, ["c"], "id"));
  assert.throws(() => createWeeklyRule({ ...input, weekdays: [1], offerId: "missing" }, ["c"], "id"));
  const good = createWeeklyRule({ ...input, weekdays: [1] }, ["c"], "id");
  assert.equal(good.enabled, true);
});

test("agenda permite backup local e rejeita regras adulteradas", () => {
  const rule = createWeeklyRule({ offerId: "c", weekdays: [1, 5], time: "08:30", channel: "whatsapp", destinationLabel: "Grupo" }, ["c"], "id");
  assert.deepEqual(parseWeeklyRules(exportWeeklyRules([rule])), [rule]);
  assert.throws(() => parseWeeklyRules(exportWeeklyRules([rule, rule])));
  assert.throws(() => parseWeeklyRules(JSON.stringify({ version: 1, timezone: "America/Sao_Paulo", rules: [{ ...rule, channel: "telegram" }] })));
});

test("fuso de São Paulo, horário vencido e regra pausada", () => {
  const rule = createWeeklyRule({ offerId: "c", weekdays: [5], time: "08:00", channel: "whatsapp", destinationLabel: "" }, ["c"], "r");
  const current = new Date("2026-11-13T12:00:00Z"); // 09:00 BRT
  const due = upcomingOccurrences([rule], [cut], current, 1);
  assert.equal(due.length, 1);
  assert.equal(due[0].due, true);
  assert.equal(upcomingOccurrences([{ ...rule, enabled: false }], [cut], current, 7).length, 0);
  assert.equal(upcomingOccurrences([rule], [], current, 7).length, 0);
});
