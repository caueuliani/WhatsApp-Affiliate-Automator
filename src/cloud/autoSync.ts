import { parseCloudSnapshot, readLocalCloudSnapshot, type CloudSaveInput, type CloudSnapshot, type CloudStateInput } from "./state";

export type SyncState = "off" | "synced" | "uploaded" | "remote_updated" | "conflict" | "invalid" | "offline";
export type SyncStatus = { state: SyncState; message: string; checkedAt: string };
type Baseline = { version: 1; revision: number; fingerprint: string; offers: number; rules: number };
type SyncStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const AUTO_SYNC_INTERVAL_MS = 30_000;
export const autoEnabledKey = (uid: string) => "affiliate-operator:auto-sync:enabled:v1:" + uid;
export const autoBaselineKey = (uid: string) => "affiliate-operator:auto-sync:baseline:v1:" + uid;
export const autoStatusKey = (uid: string) => "affiliate-operator:auto-sync:status:v1:" + uid;

function notify() {
  // Pure functions remain testable in Node; the browser UI may subscribe.
  if (typeof window !== "undefined") window.dispatchEvent(new Event("affiliate-operator:sync-status"));
}
function status(storage: SyncStorage, uid: string, state: SyncState, message: string): SyncStatus {
  const next = { state, message, checkedAt: new Date().toISOString() };
  try { storage.setItem(autoStatusKey(uid), JSON.stringify(next)); } catch { /* Local quota: no unsafe write occurs. */ }
  notify();
  return next;
}
export function getAutoSyncStatus(uid: string, storage: Pick<Storage, "getItem">): SyncStatus | null {
  try {
    const raw = storage.getItem(autoStatusKey(uid));
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    const row = data as Record<string, unknown>;
    if (!["off","synced","uploaded","remote_updated","conflict","invalid","offline"].includes(String(row.state))
      || typeof row.message !== "string" || typeof row.checkedAt !== "string") return null;
    return data as SyncStatus;
  } catch { return null; }
}

export function autoSyncEnabled(uid: string, storage: Pick<Storage, "getItem">): boolean {
  try { return storage.getItem(autoEnabledKey(uid)) === "true"; }
  catch { return false; }
}
function readBaseline(uid: string, storage: Pick<Storage, "getItem">): Baseline | null {
  try {
    const raw = storage.getItem(autoBaselineKey(uid));
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const row = data as Record<string, unknown>;
    if (row.version !== 1 || !Number.isSafeInteger(row.revision) || (row.revision as number) < 0
      || typeof row.fingerprint !== "string" || !/^[0-9a-f]{64}$/.test(row.fingerprint)
      || !Number.isSafeInteger(row.offers) || !Number.isSafeInteger(row.rules)) return null;
    return row as Baseline;
  } catch { return null; }
}

export async function snapshotFingerprint(snapshot: CloudStateInput): Promise<string> {
  // Stable across D1 ordering and localStorage ordering. URLs are never normalized or re-tagged.
  const canonical = JSON.stringify({
    offers: [...snapshot.offers].sort((a, b) => a.id.localeCompare(b.id)),
    rules: [...snapshot.rules].sort((a, b) => a.id.localeCompare(b.id)),
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function writeBaseline(uid: string, storage: SyncStorage, snapshot: CloudStateInput, revision: number): Promise<void> {
  const fingerprint = await snapshotFingerprint(snapshot);
  const marker: Baseline = { version: 1, revision, fingerprint, offers: snapshot.offers.length, rules: snapshot.rules.length };
  storage.setItem(autoBaselineKey(uid), JSON.stringify(marker));
}
/** Called after an explicitly confirmed manual upload or local restore. Never enables automatically. */
export async function markManualBaseline(uid: string, storage: SyncStorage, snapshot: CloudStateInput, revision: number) {
  await writeBaseline(uid, storage, snapshot, revision);
  status(storage, uid, "synced", "Base revisada. O envio automático continua desativado até você ativá-lo.");
}

export function disableAutoSync(uid: string, storage: SyncStorage, reason = "Sincronização automática desativada."): void {
  storage.removeItem(autoEnabledKey(uid));
  status(storage, uid, "off", reason);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("affiliate-operator:sync-toggle"));
}

/** Explicit opt-in is only permitted when local state exactly matches the latest D1 snapshot. */
export async function enableAutoSync(uid: string, storage: SyncStorage, remote: CloudSnapshot): Promise<void> {
  const cloud = parseCloudSnapshot(remote);
  const local = readLocalCloudSnapshot(uid, storage);
  if (await snapshotFingerprint(local) !== await snapshotFingerprint(cloud)) {
    throw new Error("Os dados do dispositivo são diferentes dos dados da nuvem. Primeiro escolha Enviar para a nuvem OU Restaurar da nuvem, confira o resultado e tente ativar novamente.");
  }
  await writeBaseline(uid, storage, local, cloud.revision);
  storage.setItem(autoEnabledKey(uid), "true");
  status(storage, uid, "synced", "Backup automático ativo. Mudanças em outro dispositivo exigem revisão antes de restaurar.");
  if (typeof window !== "undefined") window.dispatchEvent(new Event("affiliate-operator:sync-toggle"));
}

export type SyncApi = {
  load: () => Promise<unknown>;
  save: (input: CloudSaveInput) => Promise<{ ok: boolean; revision: number }>;
};

function halt(uid: string, storage: SyncStorage, state: SyncState, message: string): SyncStatus {
  storage.removeItem(autoEnabledKey(uid));
  const outcome = status(storage, uid, state, message);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("affiliate-operator:sync-toggle"));
  return outcome;
}

/**
 * Fail-closed, opt-in, automatic *upload only*.
 * Remote changes are detected but NEVER automatically restored, protecting unsaved form drafts.
 * D1 compare-and-swap expectedRevision prevents stale writers from overwriting the cloud.
 */
export async function syncOneSafeCycle(uid: string, storage: SyncStorage, api: SyncApi): Promise<SyncStatus | null> {
  if (!autoSyncEnabled(uid, storage)) return null;
  const base = readBaseline(uid, storage);
  if (!base) return halt(uid, storage, "invalid", "Base de sincronização ausente. Faça backup manual e ative novamente.");
  let local: CloudStateInput;
  try { local = readLocalCloudSnapshot(uid, storage); }
  catch { return halt(uid, storage, "invalid", "Ofertas ou agenda locais inválidas. Nada foi enviado. Corrija e refaça o backup manual."); }
  let remote: CloudSnapshot;
  try { remote = parseCloudSnapshot(await api.load()); }
  catch { return status(storage, uid, "offline", "Não foi possível consultar a nuvem. Os dados locais não foram alterados; tentaremos novamente."); }
  const [localHash, remoteHash] = await Promise.all([snapshotFingerprint(local), snapshotFingerprint(remote)]);
  if (remote.revision !== base.revision || remoteHash !== base.fingerprint) {
    if (localHash === base.fingerprint) {
      return halt(uid, storage, "remote_updated", "Outro dispositivo atualizou a nuvem. Confira e use Restaurar da nuvem para recebê-la, sem apagar rascunhos.");
    }
    return halt(uid, storage, "conflict", "Há mudanças neste aparelho E na nuvem. O backup automático foi interrompido para evitar perda de ofertas.");
  }
  if (localHash === base.fingerprint) {
    return status(storage, uid, "synced", "Ofertas e agenda correspondem à última revisão confirmada.");
  }
  if (base.offers > 0 && local.offers.length === 0 || base.rules > 0 && local.rules.length === 0) {
    return halt(uid, storage, "invalid", "A biblioteca ou a agenda foi esvaziada. Confirme manualmente antes de substituir o backup na nuvem.");
  }
  // Re-read before the write: user may have disabled sync or edited local data while the request was running.
  if (!autoSyncEnabled(uid, storage)
    || readBaseline(uid, storage)?.fingerprint !== base.fingerprint
    || readBaseline(uid, storage)?.revision !== base.revision
    || await snapshotFingerprint(readLocalCloudSnapshot(uid, storage)) !== localHash) {
    return status(storage, uid, "offline", "Dados mudaram durante a verificação. Será feita uma nova comparação antes de enviar.");
  }
  try {
    const result = await api.save({ ...local, expectedRevision: base.revision });
    if (!result.ok || result.revision !== base.revision + 1) {
      return halt(uid, storage, "invalid", "A nuvem não confirmou a revisão. Backup automático interrompido.");
    }
    if (!autoSyncEnabled(uid, storage)) {
      return status(storage, uid, "offline", "O envio terminou após a sincronização ter sido desativada. Confira a revisão antes de reativar.");
    }
    await writeBaseline(uid, storage, local, result.revision);
    return status(storage, uid, "uploaded", "Backup atualizado automaticamente na nuvem, revisão " + result.revision + ".");
  } catch (error) {
    const isConflict = error instanceof Error && /conflito|revision|revisão|409/i.test(error.message);
    if (isConflict) {
      return halt(uid, storage, "conflict", "Outro dispositivo alterou o D1 durante o envio. Nenhuma restauração local foi feita; revise antes de reativar.");
    }
    return status(storage, uid, "offline", "Envio indisponível. Seus dados locais continuam intactos; tentaremos novamente.");
  }
}
