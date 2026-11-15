import { test } from "node:test";
import { strict as assert } from "node:assert";
import { auditAffiliateLinks, linkAuditTextReport } from "../src/offers/linkAudit";
import { createDraft, exportLibrary, parseLibrary, type OfferDraft } from "../src/offers/library";

const offer = (id: string, link: string, affiliateProgram: "mercado_livre" | "other" = "mercado_livre"): OfferDraft =>
  createDraft({title:"Oferta "+id,message:"Publicidade",link,price:"",plannedAt:"",affiliateProgram},"id-"+id,new Date("2026-11-15T10:00:00Z"));

test("reconhece formato de compartilhamento oficial, sem afirmar que a comissão é válida", () => {
  const o=offer("a","https://meli.la/AbCd?tag=original%2Btracking");
  const report=auditAffiliateLinks([o]);
  assert.equal(report.inspected,1);
  assert.equal(report.compatible,1);
  assert.equal(report.attention,0);
  assert.equal(report.rows[0].shape,"share");
  assert.equal(report.rows[0].host,"meli.la");
  assert.deepEqual(report.rows[0].reasons,[]);
  assert.equal(o.link,"https://meli.la/AbCd?tag=original%2Btracking");
});

test("identifica página comum, domínio falso, credenciais e HTTP sem fazer requisição", () => {
  const cases=[
    offer("product","https://produto.mercadolivre.com.br/MLB-123456789-mouse-_JM"),
    offer("spoof","https://mercadolivre.com.br.evil.test/sec/link"),
    offer("credentials","https://user@meli.la/abc"),
    {...offer("http","https://meli.la/abc"),link:"http://meli.la/abc"},
  ];
  // Legacy backups may contain HTTP; this analyzer still handles corrupted data without throwing.
  const result=auditAffiliateLinks(cases);
  assert.equal(result.attention,4);
  assert.deepEqual(result.rows[0].reasons,["product_url"]);
  assert.deepEqual(result.rows[1].reasons,["not_mercado_livre"]);
  assert.deepEqual(result.rows[2].reasons,["unsafe_url"]);
  assert.deepEqual(result.rows[3].reasons,["unsafe_url"]);
});

test("links idênticos disparam aviso, sem deduplicar ou modificar campanhas", () => {
  const source="https://meli.la/same?affiliate_campaign=alpha%2Bbeta";
  const list=[offer("1",source),offer("2",source)];
  const old=JSON.stringify(list);
  const result=auditAffiliateLinks(list);
  assert.equal(result.attention,2);
  assert.ok(result.rows.every(row=>row.reasons.includes("identical_link")));
  assert.equal(JSON.stringify(list),old);
  assert.deepEqual(parseLibrary(exportLibrary(list)),list);
});

test("mesmo item em URLs com tracking diferente gera só aviso informativo, não duplicata", () => {
  const a=offer("a","https://produto.mercadolivre.com.br/MLB-123456789-fone-_JM?campaign=A");
  const b=offer("b","https://produto.mercadolivre.com.br/MLB-123456789-fone-_JM?campaign=B");
  const result=auditAffiliateLinks([a,b]);
  assert.ok(result.rows.every(row=>row.reasons.includes("shared_product")));
  assert.ok(result.rows.every(row=>!row.reasons.includes("identical_link")));
  assert.equal(a.link.endsWith("campaign=A"),true);
  assert.equal(b.link.endsWith("campaign=B"),true);
});

test("link vazio, codificação inválida e programa não-Mercado Livre não derrubam análise", () => {
  const noLink=offer("no-link","");
  const bad=offer("bad","https://meli.la/%E0%A4%A");
  const other=offer("other","https://example.com/produto?src=af", "other");
  const result=auditAffiliateLinks([noLink,bad,other]);
  assert.equal(result.rows.length,3);
  assert.deepEqual(result.rows[0].reasons,["missing"]);
  assert.ok(result.rows[1].reasons.includes("unsafe_url"));
  assert.equal(result.rows[2].severity,"compatible");
});

test("relatório não inclui link, parâmetros de campanha, título nem código de afiliado", () => {
  const o=offer("secret","https://meli.la/abc?tag=VERY_PRIVATE_COMMISSION");
  o.title="Oferta PRIVADA DO OPERADOR";
  const report=linkAuditTextReport(auditAffiliateLinks([o]));
  assert.match(report,/Auditoria local/);
  assert.doesNotMatch(report,/VERY_PRIVATE_COMMISSION/);
  assert.doesNotMatch(report,/PRIVADA DO OPERADOR/);
  assert.doesNotMatch(report,/https:\/\//);
});
