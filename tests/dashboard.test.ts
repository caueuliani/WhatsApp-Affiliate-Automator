import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createDraft, exportLibrary } from "../src/offers/library";
import { getOfferSummary } from "../src/dashboard/summary";

test("dashboard aggregates local offers without inventing delivery statistics", () => {
  const reference = new Date("2026-11-13T12:00:00Z");
  const offers = [
    createDraft({ title: "Uma", message: "Promoção", price: "", link: "", plannedAt: "2026-11-13T10:00:00Z" }, "1", reference),
    createDraft({ title: "Duas", message: "Promoção", price: "", link: "", plannedAt: "2026-11-14T10:00:00Z" }, "2", reference),
    createDraft({ title: "Três", message: "Promoção", price: "", link: "", plannedAt: "" }, "3", reference),
  ];
  assert.deepEqual(getOfferSummary(exportLibrary(offers), reference), { total: 3, due: 1, upcoming: 1 });
});
test("dashboard remains safe when the browser has no offers or broken storage", () => {
  assert.deepEqual(getOfferSummary(null), { total: 0, due: 0, upcoming: 0 });
  assert.deepEqual(getOfferSummary("not json"), { total: 0, due: 0, upcoming: 0 });
});
