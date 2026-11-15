import { test } from "node:test";
import { strict as assert } from "node:assert";
import { prepareMercadoLivreBatch, type MercadoLivreReviewRow } from "../src/offers/mercadoLivreBatch";
import { createDraft, exportLibrary, parseLibrary } from "../src/offers/library";
import { extractMercadoLivreOffers } from "../src/offers/mercadoLivre";

const now = new Date("2026-11-14T12:00:00Z");
const makeRows = (text: string): MercadoLivreReviewRow[] => extractMercadoLivreOffers(text).map(candidate => ({
  candidate, selected: true, title: candidate.titleSuggestion,
}));

test("imports two reviewed links, keeping original affiliate query and no invented price", () => {
  const rows = makeRows("Fone Bluetooth\nhttps://meli.la/ABC123?tag=p%2B1\n\nMouse Gamer\nhttps://mercadolivre.com/sec/xyz9?ref=ab%2Fcd");
  const newIds = ["new1", "new2"];
  const created = prepareMercadoLivreBatch(rows, [], () => newIds.shift()!, now);
  assert.equal(created.length, 2);
  assert.equal(created[0].link, "https://meli.la/ABC123?tag=p%2B1");
  assert.equal(created[1].link, "https://mercadolivre.com/sec/xyz9?ref=ab%2Fcd");
  assert.equal(created[0].affiliateProgram, "mercado_livre");
  assert.equal(created[0].priceCents, null);
  assert.equal(created[0].plannedAt, null);
  assert.match(created[0].message, /Publicidade/);
  assert.deepEqual(parseLibrary(exportLibrary(created)), created);
});

test("never imports unselected candidates", () => {
  const rows = makeRows("Headset com fio\nhttps://meli.la/abc1\nCabo USB\nhttps://meli.la/abc2");
  rows[1].selected = false;
  const created = prepareMercadoLivreBatch(rows, [], () => "id1", now);
  assert.equal(created.length, 1);
  assert.equal(created[0].link, rows[0].candidate.link);
});

test("does not save placeholders or empty names; requires deliberate selection", () => {
  const rows = makeRows("https://meli.la/abcdef");
  assert.throws(() => prepareMercadoLivreBatch(rows, [], () => "id1", now), /Revise o nome real/);
  rows[0].title = "   ";
  assert.throws(() => prepareMercadoLivreBatch(rows, [], () => "id1", now), /Revise o nome real/);
  rows[0].selected = false;
  assert.throws(() => prepareMercadoLivreBatch(rows, [], () => "id1", now), /Selecione/);
});

test("blocks existing links, duplicate batch links and title overflow", () => {
  const rows = makeRows("Produto A\nhttps://meli.la/abc1");
  const present = createDraft({ title:"Existente",message:"Texto",link:rows[0].candidate.link,price:"",plannedAt:"" }, "old1");
  assert.throws(() => prepareMercadoLivreBatch(rows, [present], () => "id1", now), /já está/);
  rows[0].title = "Produto A";
  assert.throws(() => prepareMercadoLivreBatch([...rows, ...rows], [], () => "id1", now), /duplicado|mais de uma vez/);
  assert.throws(() => prepareMercadoLivreBatch([{ ...rows[0], title:"A".repeat(121) }], [], () => "id1", now), /Revise o nome real/);
});

test("blocks modified or non-ML links and invalid identifiers", () => {
  const rows = makeRows("Produto válido\nhttps://meli.la/abc1");
  assert.throws(() => prepareMercadoLivreBatch([{...rows[0],candidate:{...rows[0].candidate,link:"https://fake-meli.la/abc1"}}], [],()=> "id1",now));
  assert.throws(() => prepareMercadoLivreBatch(rows,[],()=> "../x",now), /Identificador/);
});

test("enforces 100-offer cap before writing any item", () => {
  const rows=makeRows("Oferta válida\nhttps://meli.la/new123");
  const current=Array.from({length:100},(_,i)=>createDraft({title:"Item "+i,message:"Texto",link:"https://example.org/"+i,price:"",plannedAt:""},"old"+i));
  assert.throws(()=>prepareMercadoLivreBatch(rows,current,()=> "id1",now), /Limite/);
});
