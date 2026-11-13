import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createDraft, parseLibrary, exportLibrary, normalizeAffiliateLink, scheduledState, storageKey } from "../src/offers/library";

const base = { title: " Produto ", message: " Oferta imperdível ", link: "https://exemplo.com/p", price: "99.90", plannedAt: "" };
test("normalizes draft fields and price", () => {
  const result = createDraft(base, "id1", new Date("2026-11-13T12:00:00Z"));
  assert.equal(result.title, "Produto");
  assert.equal(result.priceCents, 9990);
  assert.equal(result.message, "Oferta imperdível");
  assert.equal(result.link, "https://exemplo.com/p");
  assert.equal(result.plannedAt, null);
  assert.equal(storageKey("one").endsWith("one"), true);
});
test("rejects invalid offer links and excessive content", () => {
  assert.throws(() => normalizeAffiliateLink("javascript:alert(1)"));
  assert.throws(() => normalizeAffiliateLink("http://example.org"));
  assert.throws(() => createDraft({ ...base, title: "" }, "id1"));
  assert.throws(() => createDraft({ ...base, message: "x".repeat(3001) }, "id1"));
  assert.throws(() => createDraft({ ...base, price: "-1" }, "id1"));
});
test("scheduling is a visual status, not an automatic send", () => {
  const offer = createDraft({ ...base, plannedAt: "2026-11-13T10:00:00Z" }, "id1");
  assert.equal(scheduledState(offer, new Date("2026-11-13T09:00:00Z")), "upcoming");
  assert.equal(scheduledState(offer, new Date("2026-11-13T11:00:00Z")), "due");
});
test("supports JSON backup roundtrip", () => {
  const draft = createDraft(base, "id1");
  assert.deepEqual(parseLibrary(exportLibrary([draft])), [draft]);
});
test("rejects malformed backups and duplicates", () => {
  const draft = createDraft(base, "id1");
  assert.throws(() => parseLibrary("{"));
  assert.throws(() => parseLibrary(JSON.stringify({ version: 1, offers: [{ ...draft, link: "http://unsafe" }] })));
  assert.throws(() => parseLibrary(exportLibrary([draft, draft])));
  assert.throws(() => parseLibrary(JSON.stringify({ version: 2, offers: [] })));
});

test("salva metadados de campanha sem reescrever a URL de afiliado", () => {
  const source = "https://www.mercadolivre.com.br/exemplo?tracking=abc123";
  const draft = createDraft({ ...base, affiliateProgram: "mercado_livre", trackingLabel: "jardim-novembro", link: source }, "tag1");
  assert.equal(draft.link, source);
  assert.equal(draft.affiliateProgram, "mercado_livre");
  assert.equal(draft.trackingLabel, "jardim-novembro");
  assert.deepEqual(parseLibrary(exportLibrary([draft])), [draft]);
  assert.throws(() => createDraft({ ...base, trackingLabel: "x".repeat(61) }, "bad"));
});
