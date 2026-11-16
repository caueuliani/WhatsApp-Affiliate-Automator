import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createDraft, exportLibrary, parseLibrary, storageKey, type OfferDraft } from "../src/offers/library";
import { categorizeOffers, filterCatalog, DEFAULT_CATALOG_FILTERS } from "../src/offers/catalog";
import { auditAffiliateLinks } from "../src/offers/linkAudit";
import { exportWeeklyRules, scheduleKey } from "../src/schedule/weekly";
import { autoSyncEnabled, enableAutoSync, syncOneSafeCycle } from "../src/cloud/autoSync";
import type { CloudSnapshot } from "../src/cloud/state";

const uid="release-candidate-test-user";
function memoryStorage() {
  const values=new Map<string,string>();
  return {
    getItem:(key:string)=>values.get(key) ?? null,
    setItem:(key:string,val:string)=>{values.set(key,val);},
    removeItem:(key:string)=>{values.delete(key);}
  };
}
function makeOffer(id:string, tag:string): OfferDraft {
  return createDraft({
    title:"Oferta "+id,
    message:"Publicidade: produto de teste",
    link:"https://meli.la/"+id+"?tag="+tag,
    price:"", plannedAt:"",
    affiliateProgram:"mercado_livre",category:"outros",
  },id,new Date("2026-11-15T11:00:00Z"));
}
const original=makeOffer("produto1","keep%2Bthis");
function local(store:ReturnType<typeof memoryStorage>, offers:OfferDraft[]) {
  store.setItem(storageKey(uid),exportLibrary(offers));
  store.setItem(scheduleKey(uid),exportWeeklyRules([]));
}
function remote(offers:OfferDraft[],revision:number):CloudSnapshot{
  return {offers,rules:[],revision};
}

test("candidate #21+#22+#23: categorized offers safely back up without changing affiliate URLs",async()=>{
  const store=memoryStorage();
  local(store,[original]);
  await enableAutoSync(uid,store,remote([original],8));
  const categorized=categorizeOffers([original],new Set([original.id]),"games",new Date("2026-11-15T12:00:00Z"));
  local(store,categorized);
  assert.deepEqual(filterCatalog(categorized,{...DEFAULT_CATALOG_FILTERS,category:"games"}).map(x=>x.id),["produto1"]);
  assert.equal(auditAffiliateLinks(categorized).attention,0);
  let sent:unknown;
  const result=await syncOneSafeCycle(uid,store,{
    load:async()=>remote([original],8),
    save:async input=>{sent=input;return {ok:true,revision:9};},
  });
  assert.equal(result?.state,"uploaded");
  const payload=sent as {offers:OfferDraft[];expectedRevision:number};
  assert.equal(payload.expectedRevision,8);
  assert.equal(payload.offers[0].category,"games");
  assert.equal(payload.offers[0].link,"https://meli.la/produto1?tag=keep%2Bthis");
  assert.deepEqual(parseLibrary(exportLibrary(payload.offers)),payload.offers);
  assert.equal(store.getItem(storageKey(uid))?.includes("keep%2Bthis"),true);
});

test("candidate #21+#22+#23: conflicting catalog edits are never uploaded or overwritten",async()=>{
  const store=memoryStorage();
  local(store,[original]);
  await enableAutoSync(uid,store,remote([original],1));
  const localCategory=categorizeOffers([original],new Set(["produto1"]),"casa");
  local(store,localCategory);
  const remoteCategory=categorizeOffers([original],new Set(["produto1"]),"games");
  let attempts=0;
  const result=await syncOneSafeCycle(uid,store,{
    load:async()=>remote(remoteCategory,2),
    save:async()=>{attempts++;return {ok:true,revision:3};},
  });
  assert.equal(result?.state,"conflict");
  assert.equal(attempts,0);
  assert.equal(autoSyncEnabled(uid,store),false);
  const fromDisk=parseLibrary(store.getItem(storageKey(uid))!);
  assert.equal(fromDisk[0].category,"casa");
  assert.equal(fromDisk[0].link,original.link);
});

test("candidate #21+#22+#23: duplicate audit never deduplicates a campaign or modifies stored snapshots",()=>{
  const first=makeOffer("campaign1","campaignA%2B1");
  const duplicate={...first,id:"campaign2"};
  const offers=[first,duplicate];
  const before=exportLibrary(offers);
  const findings=auditAffiliateLinks(offers);
  assert.equal(findings.attention,2);
  assert.ok(findings.rows.every(row=>row.reasons.includes("identical_link")));
  assert.equal(exportLibrary(offers),before);
  assert.equal(parseLibrary(before).length,2);
});
