import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createDraft, exportLibrary, storageKey } from "../src/offers/library";
import { createWeeklyRule, exportWeeklyRules, scheduleKey } from "../src/schedule/weekly";
import { parseCloudSnapshot, readLocalCloudSnapshot, recoveryIsAvailable, recoveryStorageKey, restoreCloudToLocal, undoCloudRestore } from "../src/cloud/state";

function memoryStorage() {
  const entries = new Map<string, string>();
  return {
    getItem: (k: string) => entries.get(k) ?? null,
    setItem: (k: string, v: string) => { entries.set(k, v); },
    removeItem: (k: string) => { entries.delete(k); },
  };
}
const offer = createDraft({ title: "Fone", message: "Publicidade: oferta", link: "https://meli.la/minha-tag", price: "", plannedAt: "" }, "offer-1");
const rule = createWeeklyRule({ offerId: offer.id, weekdays: [1], time: "14:00", channel: "whatsapp", destinationLabel: "Grupo público" }, [offer.id], "rule-1");
test("validates cloud state, revision, and referential integrity", () => {
  const cloud = parseCloudSnapshot({ offers: [offer], rules: [rule], revision: 2 });
  assert.equal(cloud.offers[0].link, offer.link);
  assert.equal(cloud.revision, 2);
  assert.throws(() => parseCloudSnapshot({ offers: [offer], rules: [rule], revision: -1 }));
  assert.throws(() => parseCloudSnapshot({ offers: [], rules: [rule], revision: 1 }));
  assert.throws(() => parseCloudSnapshot({ offers: [{ ...offer, id: "../evil" }], rules: [], revision: 1 }));
});
test("reads local snapshots without changing existing backup format", () => {
  const storage = memoryStorage();
  storage.setItem(storageKey("u1"), exportLibrary([offer]));
  storage.setItem(scheduleKey("u1"), exportWeeklyRules([rule]));
  assert.deepEqual(readLocalCloudSnapshot("u1", storage), { offers: [offer], rules: [rule] });
});
test("restores cloud with local recovery and can undo", () => {
  const storage = memoryStorage();
  const original = createDraft({ title: "Antiga", message: "Texto", link: "https://example.org/1", price: "", plannedAt: "" }, "original-1");
  storage.setItem(storageKey("u1"), exportLibrary([original]));
  storage.setItem(scheduleKey("u1"), exportWeeklyRules([]));
  restoreCloudToLocal("u1", { offers: [offer], rules: [rule], revision: 3 }, storage);
  assert.equal(readLocalCloudSnapshot("u1", storage).offers[0].id, offer.id);
  assert.equal(recoveryIsAvailable("u1", storage), true);
  assert.match(storage.getItem(recoveryStorageKey("u1"))!, /original-1/);
  undoCloudRestore("u1", storage);
  assert.equal(readLocalCloudSnapshot("u1", storage).offers[0].id, original.id);
  assert.equal(recoveryIsAvailable("u1", storage), false);
});
test("rejects invalid cloud payload without overwriting local records", () => {
  const storage = memoryStorage();
  storage.setItem(storageKey("u1"), exportLibrary([offer]));
  assert.throws(() => restoreCloudToLocal("u1", { offers: [], rules: [rule], revision: 1 }, storage));
  assert.equal(readLocalCloudSnapshot("u1", storage).offers[0].id, offer.id);
});

test("revision-aware cloud saves reject client payloads without explicit base revision", () => {
  // The frontend will send an expectedRevision with every cloud upload.
  assert.throws(() => parseCloudSnapshot({ offers: [], rules: [], revision: "0" }));
});
