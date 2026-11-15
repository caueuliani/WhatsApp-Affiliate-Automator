import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createDraft, exportLibrary, storageKey } from "../src/offers/library";
import { createWeeklyRule, exportWeeklyRules, scheduleKey } from "../src/schedule/weekly";
import { autoSyncEnabled, disableAutoSync, enableAutoSync, getAutoSyncStatus, markManualBaseline, snapshotFingerprint, syncOneSafeCycle } from "../src/cloud/autoSync";
import type { CloudSnapshot } from "../src/cloud/state";

function memoryStorage() {
  const data = new Map<string,string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k,v); },
    removeItem: (k: string) => { data.delete(k); }
  };
}
const makeOffer = (id: string, title = id) => createDraft({
  title, message: "Publicidade: promoção", link: "https://meli.la/"+id+"?tracking=stay%2Bhere",
  price:"", plannedAt:"", affiliateProgram:"mercado_livre"
},id,new Date("2026-11-15T12:00:00Z"));
const offer = makeOffer("item1");
const rule = createWeeklyRule({offerId:offer.id,weekdays:[1],time:"14:00",channel:"whatsapp",destinationLabel:"Grupo autorizado"},[offer.id],"rule1",new Date("2026-11-15T12:00:00Z"));
const empty: CloudSnapshot = { offers: [], rules: [], revision:0 };
const snapshot = (offers=[offer],rules=[rule],revision=1): CloudSnapshot => ({offers,rules,revision});
const local = (storage: ReturnType<typeof memoryStorage>, offers=[offer],rules=[rule]) => {
  storage.setItem(storageKey("u1"),exportLibrary(offers));
  storage.setItem(scheduleKey("u1"),exportWeeklyRules(rules));
};

test("auto sync is off by default and never contacts remote before opt-in", async () => {
  const store=memoryStorage();
  let calls=0;
  assert.equal(autoSyncEnabled("u1",store),false);
  const result=await syncOneSafeCycle("u1",store,{load:async()=>{calls++;return empty;},save:async()=>{calls++;return {ok:true,revision:1};}});
  assert.equal(result,null);assert.equal(calls,0);
});

test("activation rejects different cloud snapshots; cannot silently replace other device offers", async () => {
  const store=memoryStorage();
  local(store,[offer],[]);
  await assert.rejects(enableAutoSync("u1",store,empty), /diferentes/);
  assert.equal(autoSyncEnabled("u1",store),false);
});

test("stable fingerprint ignores array order, preserves tracking differences", async () => {
  const second=makeOffer("item2");
  assert.equal(await snapshotFingerprint(snapshot([offer,second],[],1)),
    await snapshotFingerprint(snapshot([second,offer],[],99)));
  assert.notEqual(await snapshotFingerprint(snapshot([offer],[],1)),
    await snapshotFingerprint(snapshot([{...offer,link:offer.link+"X"}],[],1)));
});

test("after manual alignment, changes are safely uploaded with CAS revision", async () => {
  const store=memoryStorage();
  local(store);
  await enableAutoSync("u1",store,snapshot());
  const newOffer=makeOffer("item2");
  local(store,[offer,newOffer],[rule]);
  let received: unknown;
  const reply=await syncOneSafeCycle("u1",store,{
    load:async()=>snapshot(),
    save:async input=>{received=input;return {ok:true,revision:2};}
  });
  assert.equal(reply?.state,"uploaded");
  assert.equal((received as {expectedRevision:number}).expectedRevision,1);
  assert.equal((received as {offers:Array<{link:string}>}).offers[0].link,offer.link);
  const again=await syncOneSafeCycle("u1",store,{
    load:async()=>snapshot([offer,newOffer],[rule],2),
    save:async()=>{throw Error("Should not send twice");}
  });
  assert.equal(again?.state,"synced");
});

test("remote-only update pauses and never downloads over local draft", async () => {
  const store=memoryStorage();local(store);
  await enableAutoSync("u1",store,snapshot());
  let saves=0;
  const newer=snapshot([offer,makeOffer("item2")],[rule],2);
  const result=await syncOneSafeCycle("u1",store,{load:async()=>newer,save:async()=>{saves++;return {ok:true,revision:3};}});
  assert.equal(result?.state,"remote_updated");assert.equal(saves,0);
  assert.equal(autoSyncEnabled("u1",store),false);
  assert.match(store.getItem(storageKey("u1"))||"","item1");
  assert.equal(getAutoSyncStatus("u1",store)?.state,"remote_updated");
});

test("concurrent local and remote edits halt without writing; real CAS conflict halts as well", async () => {
  const store=memoryStorage();local(store);
  await enableAutoSync("u1",store,snapshot());
  local(store,[offer,makeOffer("local2")],[rule]);
  const conflict=await syncOneSafeCycle("u1",store,{
    load:async()=>snapshot([offer,makeOffer("remote2")],[rule],2),
    save:async()=>{throw Error("Must never write");}
  });
  assert.equal(conflict?.state,"conflict");
  assert.equal(autoSyncEnabled("u1",store),false);

  await enableAutoSync("u1",store,snapshot([offer,makeOffer("local2")],[rule],2));
  local(store,[offer,makeOffer("local2"),makeOffer("local3")],[rule]);
  const race=await syncOneSafeCycle("u1",store,{
    load:async()=>snapshot([offer,makeOffer("local2")],[rule],2),
    save:async()=>{throw Error("Conflito: revisão atualizada 409");}
  });
  assert.equal(race?.state,"conflict");
  assert.equal(autoSyncEnabled("u1",store),false);
});

test("no auto-upload when library or schedule suddenly becomes empty", async () => {
  const store=memoryStorage();local(store);
  await enableAutoSync("u1",store,snapshot());
  local(store,[],[]);
  const res=await syncOneSafeCycle("u1",store,{
    load:async()=>snapshot(),save:async()=>{throw Error("Unexpected destructive request");}
  });
  assert.equal(res?.state,"invalid");assert.equal(autoSyncEnabled("u1",store),false);
});

test("offline preserves sync opt-in and local data to retry later", async () => {
  const store=memoryStorage();local(store);
  await enableAutoSync("u1",store,snapshot());
  local(store,[offer,makeOffer("item2")],[rule]);
  const res=await syncOneSafeCycle("u1",store,{
    load:async()=>{throw Error("503 unavailable");},
    save:async()=>{throw Error("No write");}
  });
  assert.equal(res?.state,"offline");assert.equal(autoSyncEnabled("u1",store),true);
  assert.equal(JSON.parse(store.getItem(storageKey("u1"))||"{}").offers.length,2);
});

test("manual baseline does not enable auto sync; explicit disable makes it inert", async () => {
  const store=memoryStorage();local(store);
  await markManualBaseline("u1",store,snapshot(),3);
  assert.equal(autoSyncEnabled("u1",store),false);
  await enableAutoSync("u1",store,snapshot([offer],[rule],3));
  disableAutoSync("u1",store);
  assert.equal(await syncOneSafeCycle("u1",store,{load:async()=>{throw Error("Not called");},save:async()=>{throw Error("Not called");}}),null);
});
