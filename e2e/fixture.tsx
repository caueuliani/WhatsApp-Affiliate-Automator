/**
 * Local Playwright component-integration fixture.
 * This page is served only by the Vite dev server, never bundled in dist/.
 * No Firebase login override or production auth bypass exists.
 * Cloudflare D1 is emulated in localStorage to exercise actual UI and recovery.
 */
import React, { useCallback } from "react";
import { createRoot } from "react-dom/client";
import OfferLibrary from "../src/components/OfferLibrary";
import CloudSyncPanel from "../src/components/CloudSyncPanel";
import type { CloudSaveInput, CloudSnapshot } from "../src/cloud/state";
import "../src/index.css";

const uid = "e2e-test-only";
const cloudKey = "affiliate-operator:e2e-d1-fixture";
const initialCloud: CloudSnapshot = { offers: [], rules: [], revision: 0 };

function readFixtureCloud(): CloudSnapshot {
  const stored = localStorage.getItem(cloudKey);
  return stored ? JSON.parse(stored) as CloudSnapshot : initialCloud;
}

function Fixture() {
  const loadState = useCallback(async (): Promise<CloudSnapshot> => readFixtureCloud(), []);
  const saveState = useCallback(async ({ offers, rules, expectedRevision }: CloudSaveInput): Promise<{ ok: boolean; revision: number }> => {
    const previous = readFixtureCloud();
    if (previous.revision !== expectedRevision) throw new Error("Conflito: revisão da nuvem desatualizada.");
    const next = { offers, rules, revision: previous.revision + 1 };
    localStorage.setItem(cloudKey, JSON.stringify(next));
    return { ok: true, revision: next.revision };
  }, []);
  return <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
    <h1 className="text-2xl font-bold">Fixture E2E — Ofertas</h1>
    <CloudSyncPanel uid={uid} loadState={loadState} saveState={saveState}/>
    <OfferLibrary uid={uid} onUse={() => { throw new Error("Não publicar em teste E2E"); }}/>
  </main>;
}

createRoot(document.getElementById("root")!).render(<Fixture/>);
