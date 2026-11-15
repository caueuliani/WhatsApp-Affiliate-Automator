import { test } from "node:test";
import { strict as assert } from "node:assert";
import { QA_CASES, exportQaReport, parseQaProgress, qaKey, qaTotals, serializeQaProgress } from "../src/qa/homologation";

test("45 casos de homologação são únicos e têm prioridade e resultados esperados", () => {
  assert.equal(QA_CASES.length,45);
  assert.equal(new Set(QA_CASES.map(x=>x.id)).size,45);
  assert.deepEqual(QA_CASES.map(x=>x.id),Array.from({length:45},(_,i)=>i+1));
  assert.equal(QA_CASES.every(x=>x.expected && ["P0","P1","P2"].includes(x.priority)),true);
});

test("progresso local somente guarda status permitidos para itens reais", () => {
  const parsed=parseQaProgress(JSON.stringify({version:1,statuses:{"1":"passed","2":"failed","5":"blocked","50":"passed","3":"exfiltrate"}}));
  assert.deepEqual(parsed,{1:"passed",2:"failed",5:"blocked"});
  assert.deepEqual(parseQaProgress(serializeQaProgress(parsed)),parsed);
  assert.deepEqual(parseQaProgress('{"version":2,"statuses":{}}'),{});
  assert.deepEqual(parseQaProgress("{notjson"),{});
});

test("relatório evita incluir dados privados e contabiliza somente status", () => {
  const progress={1:"passed",2:"failed",5:"blocked"} as const;
  const totals=qaTotals(progress);
  assert.deepEqual(totals,{total:45,passed:1,failed:1,blocked:1,pending:42});
  const report=exportQaReport(progress);
  assert.match(report,/01\. \[P0\] \[OK\]/);
  assert.match(report,/02\. \[P0\] \[Falhou\]/);
  assert.match(report,/03\. \[P0\] \[Pendente\]/);
  assert.match(report,/issues\/17/);
  assert.doesNotMatch(report,/meli\.la\//);
  assert.match(qaKey("uid1"),/uid1$/);
});
