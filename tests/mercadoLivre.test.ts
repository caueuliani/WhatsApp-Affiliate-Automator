import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createImportDraft, extractMercadoLivreOffers, isMercadoLivreHost, parseMercadoLivreLink } from "../src/offers/mercadoLivre";

test("validates official hosts without suffix spoofing", () => {
  assert.equal(isMercadoLivreHost("produto.mercadolivre.com.br"), true);
  assert.equal(isMercadoLivreHost("meli.la"), true);
  assert.equal(isMercadoLivreHost("mercadolivre.com.br.evil.org"), false);
  assert.equal(isMercadoLivreHost("fake-mercadolivre.com.br"), false);
  assert.throws(() => parseMercadoLivreLink("https://mercadolivre.com.br.evil.org/sec/fake"));
  assert.throws(() => parseMercadoLivreLink("https://mercadolivre.com.br@evil.org/sec/fake"));
  assert.throws(() => parseMercadoLivreLink("http://meli.la/abc"));
  assert.throws(() => parseMercadoLivreLink("https://other.com/a"));
});
test("preserves the complete original tracking URL without resolving redirects", () => {
  const link = "https://mercadolivre.com/sec/1abcDEF?foo=x%2By&tag=original";
  const result = parseMercadoLivreLink(link);
  assert.equal(result.link, link);
  assert.equal(result.linkKind, "share");
  assert.equal(result.itemId, null);
  const product = parseMercadoLivreLink("https://produto.mercadolivre.com.br/MLB-123456789-fone-headset-_JM");
  assert.equal(product.itemId, "MLB123456789");
  assert.equal(product.linkKind, "product");
});
test("recognizes shared messages and auto-fills only unverified description", () => {
  const result = extractMercadoLivreOffers("Fone sem fio premium\nhttps://meli.la/Abc09?tag=abc");
  assert.equal(result.length, 1);
  assert.equal(result[0].titleSuggestion, "Fone sem fio premium");
  const draft = createImportDraft(result[0]);
  assert.equal(draft.link, "https://meli.la/Abc09?tag=abc");
  assert.equal(draft.affiliateProgram, "mercado_livre");
  assert.equal(draft.price, "");
  assert.match(draft.message, /Publicidade/);
});
test("can ingest multiple links, dedupe, and accept bare meli.la", () => {
  const items = extractMercadoLivreOffers("https://meli.la/a1\nhttps://meli.la/a1\nhttps://www.mercadolivre.com.br/fone-sem-fio/p/MLB123456789");
  assert.equal(items.length, 2);
  assert.match(items[1].titleSuggestion, /Fone sem fio/i);
  assert.equal(extractMercadoLivreOffers("meli.la/a1")[0].link, "https://meli.la/a1");
});
test("rejects oversized content, unsupported URLs, and over-limit batches", () => {
  assert.throws(() => extractMercadoLivreOffers("a".repeat(12001)));
  assert.throws(() => extractMercadoLivreOffers("https://mercadolivre.com.br.evil.com/a"));
  assert.throws(() => extractMercadoLivreOffers(Array.from({length:21},(_,i)=>"https://meli.la/a"+i).join("\n")));
});
