import { test } from "node:test";
import { strict as assert } from "node:assert";
import { categorizeOffers, DEFAULT_CATALOG_FILTERS, filterCatalog, type CatalogFilters } from "../src/offers/catalog";
import { createDraft, exportLibrary, parseLibrary, type OfferCategory, type OfferDraft } from "../src/offers/library";
import { parseCloudSnapshot } from "../src/cloud/state";

const baseline = new Date("2026-11-15T12:00:00Z");
const offer = (id: string, title: string, category?: OfferCategory, price = "", plannedAt = "", program = "mercado_livre"): OfferDraft =>
  createDraft({
    title, message: "Publicidade: " + title, link: "https://meli.la/" + id + "?utm_campaign=af%2B_" + id,
    affiliateProgram: program as "mercado_livre", trackingLabel: "campanha-novembro",
    category, price, plannedAt,
  }, id, baseline);

const mouse = offer("mouse", "Mouse Gamer", "games", "149.90");
const teclado = offer("teclado", "Teclado Mecânico", "tecnologia", "300");
const cabo = offer("cabo", "Cabo USB", "outros", "");
const dados = [teclado, cabo, mouse];

function opts(changes: Partial<CatalogFilters>): CatalogFilters {
  return { ...DEFAULT_CATALOG_FILTERS, ...changes };
}

test("pesquisa é independente de acentos, caixa, contém múltiplos termos e etiqueta", () => {
  assert.deepEqual(filterCatalog(dados, opts({ query: "MECANICO teclado" })).map(x => x.id), ["teclado"]);
  assert.deepEqual(filterCatalog(dados, opts({ query: "campanha-novembro gamer" })).map(x => x.id), ["mouse"]);
  assert.deepEqual(filterCatalog(dados, opts({ query: "af%2B_mouse" })).map(x => x.id), ["mouse"]);
  assert.equal(filterCatalog(dados, opts({ query: "produto inexistente" })).length, 0);
});

test("filtra programa, categoria e status preservando a biblioteca original", () => {
  const snapshot = JSON.stringify(dados);
  assert.deepEqual(filterCatalog(dados, opts({ category:"games" })).map(x => x.id), ["mouse"]);
  assert.deepEqual(filterCatalog(dados, opts({ category:"outros" })).map(x => x.id), ["cabo"]);
  assert.deepEqual(filterCatalog(dados, opts({ program:"shopee" })),[]);
  assert.deepEqual(filterCatalog(dados, opts({ status:"unscheduled" })).map(x => x.id).sort(), ["cabo","mouse","teclado"]);
  assert.deepEqual(filterCatalog(dados, opts({ status:"due" })),[]);
  assert.equal(JSON.stringify(dados), snapshot);
});

test("ordenação alfabética, preço com valores faltantes sempre ao fim, recentes", () => {
  assert.deepEqual(filterCatalog(dados, opts({sort:"title"})).map(x => x.id),["cabo","mouse","teclado"]);
  assert.deepEqual(filterCatalog(dados, opts({sort:"price_low"})).map(x => x.id),["mouse","teclado","cabo"]);
  assert.deepEqual(filterCatalog(dados, opts({sort:"price_high"})).map(x => x.id),["teclado","mouse","cabo"]);
  const updated = { ...cabo, updatedAt:"2026-11-16T10:00:00.000Z" };
  assert.equal(filterCatalog([mouse,teclado,updated], opts({sort:"recent"}))[0].id, "cabo");
});

test("agendamento diferencia vencidas, futuras e sem data", () => {
  const past = offer("past","Oferta vencida","outros","","2026-11-13T10:00:00");
  const future = offer("future","Oferta futura","outros","","2026-11-20T10:00:00");
  const now = new Date("2026-11-15T12:00:00Z");
  assert.deepEqual(filterCatalog([past,future,mouse],opts({status:"due"}),now).map(x=>x.id),["past"]);
  assert.deepEqual(filterCatalog([past,future,mouse],opts({status:"upcoming"}),now).map(x=>x.id),["future"]);
  assert.deepEqual(filterCatalog([past,future,mouse],opts({status:"unscheduled"}),now).map(x=>x.id),["mouse"]);
});

test("categorização em lote atualiza só itens selecionados e preserva literalmente os links", () => {
  const selected = new Set(["mouse","cabo"]);
  const when = new Date("2026-11-16T12:00:00Z");
  const edited = categorizeOffers(dados, selected, "tecnologia", when);
  assert.equal(edited[0], dados[0]); // unchanged offer keeps reference
  assert.equal(edited[1].category,"tecnologia");
  assert.equal(edited[2].category,"tecnologia");
  assert.equal(edited[1].updatedAt,when.toISOString());
  assert.deepEqual(edited.map(x => x.link),dados.map(x => x.link));
  assert.deepEqual(edited.map(x => x.message),dados.map(x => x.message));
  assert.deepEqual(edited.map(x => x.priceCents),dados.map(x => x.priceCents));
  assert.equal(dados[1].category, "outros"); // pure, no data mutation
  assert.deepEqual(parseLibrary(exportLibrary(edited)), edited);
  assert.deepEqual(parseCloudSnapshot({offers:edited,rules:[],revision:2}).offers,edited);
});

test("não modifica seleção desconhecida, categoria inválida ou lote vazio", () => {
  assert.throws(() => categorizeOffers(dados,new Set([]),"games"),/Selecione/);
  assert.throws(() => categorizeOffers(dados,new Set(["not-found"]),"games"),/seleção mudou/);
  assert.throws(() => categorizeOffers(dados,new Set(["mouse"]),"invalid" as OfferCategory),/Categoria inválida/);
});

test("backups legados sem categoria continuam válidos e entram na categoria Outros", () => {
  const older = { ...mouse } as OfferDraft;
  delete older.category;
  const oldBackup = JSON.stringify({version:1,offers:[older]});
  assert.deepEqual(parseLibrary(oldBackup),[older]);
  assert.deepEqual(filterCatalog([older],opts({category:"outros"})),[older]);
  const updated = categorizeOffers([older],new Set(["mouse"]),"games");
  assert.equal(updated[0].category,"games");
  assert.equal(updated[0].link,older.link);
  assert.throws(() => parseLibrary(JSON.stringify({version:1,offers:[{...older,category:"<script>"}]})),/incompatível/);
  assert.throws(() => createDraft({
    title:"X",message:"Publicidade",link:"https://meli.la/X",price:"",plannedAt:"",
    category:"<script>" as OfferCategory,
  },"wrong-category"));
});

test("filtra programa outro para arquivos legados sem metadados", () => {
  const old = { ...mouse } as OfferDraft;
  delete old.affiliateProgram;
  assert.deepEqual(filterCatalog([old,teclado],opts({program:"other"})),[old]);
});
