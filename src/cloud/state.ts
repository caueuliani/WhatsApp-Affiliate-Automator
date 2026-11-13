import { exportLibrary, parseLibrary, storageKey, type OfferDraft } from "../offers/library";
import { exportWeeklyRules, parseWeeklyRules, scheduleKey, type WeeklyRule } from "../schedule/weekly";

export type CloudSnapshot = { offers: OfferDraft[]; rules: WeeklyRule[]; revision: number };
export type CloudStateInput = Pick<CloudSnapshot, "offers" | "rules">;

const validId = (id: string) => /^[A-Za-z0-9_-]{1,128}$/.test(id);

function validateState(offers: OfferDraft[], rules: WeeklyRule[]): void {
  if (!offers.every(offer => validId(offer.id)) || !rules.every(rule => validId(rule.id))) {
    throw new Error("Há identificadores incompatíveis com o D1. Revise os backups antes de sincronizar.");
  }
  const ids = new Set(offers.map(offer => offer.id));
  if (rules.some(rule => !ids.has(rule.offerId))) {
    throw new Error("A agenda contém rotinas vinculadas a ofertas não encontradas na biblioteca. Corrija antes de sincronizar.");
  }
}

export function parseCloudSnapshot(body: unknown): CloudSnapshot {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Resposta da nuvem inválida.");
  const raw = body as Record<string, unknown>;
  if (!Number.isSafeInteger(raw.revision) || (raw.revision as number) < 0 || !Array.isArray(raw.offers) || !Array.isArray(raw.rules)) {
    throw new Error("Resposta da nuvem sem versão ou dados válidos.");
  }
  const offers = parseLibrary(JSON.stringify({ version: 1, offers: raw.offers }));
  const rules = parseWeeklyRules(JSON.stringify({ version: 1, timezone: "America/Sao_Paulo", rules: raw.rules }));
  validateState(offers, rules);
  return { offers, rules, revision: raw.revision as number };
}

export function readLocalCloudSnapshot(uid: string, storage: Pick<Storage, "getItem">): CloudStateInput {
  const offers = parseLibrary(storage.getItem(storageKey(uid)) || exportLibrary([]));
  const rules = parseWeeklyRules(storage.getItem(scheduleKey(uid)) || exportWeeklyRules([]));
  validateState(offers, rules);
  return { offers, rules };
}

export function recoveryStorageKey(uid: string) {
  return "affiliate-operator:cloud-recovery:v1:" + uid;
}

type RecoverableStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type RecoveryPayload = { offers: string | null; rules: string | null; savedAt: string };

function writeBoth(storage: RecoverableStorage, uid: string, offers: string | null, rules: string | null): void {
  if (offers === null) storage.removeItem(storageKey(uid));
  else storage.setItem(storageKey(uid), offers);
  if (rules === null) storage.removeItem(scheduleKey(uid));
  else storage.setItem(scheduleKey(uid), rules);
}

function validateRecovery(data: RecoveryPayload): void {
  const offers = parseLibrary(data.offers || exportLibrary([]));
  const rules = parseWeeklyRules(data.rules || exportWeeklyRules([]));
  validateState(offers, rules);
}

/** Preserves a recovery point before any cloud-to-local overwrite. Rollback on storage failure. */
export function restoreCloudToLocal(uid: string, cloud: CloudSnapshot, storage: RecoverableStorage): void {
  validateState(cloud.offers, cloud.rules);
  const oldOffers = storage.getItem(storageKey(uid));
  const oldRules = storage.getItem(scheduleKey(uid));
  const oldRecovery = storage.getItem(recoveryStorageKey(uid));
  const previous: RecoveryPayload = { offers: oldOffers, rules: oldRules, savedAt: new Date().toISOString() };
  const nextOffers = exportLibrary(cloud.offers);
  const nextRules = exportWeeklyRules(cloud.rules);
  // Revalidate serialization before changing the persisted keys.
  validateRecovery({ offers: nextOffers, rules: nextRules, savedAt: previous.savedAt });
  storage.setItem(recoveryStorageKey(uid), JSON.stringify(previous));
  try {
    writeBoth(storage, uid, nextOffers, nextRules);
  } catch {
    try {
      writeBoth(storage, uid, oldOffers, oldRules);
      if (oldRecovery === null) storage.removeItem(recoveryStorageKey(uid));
      else storage.setItem(recoveryStorageKey(uid), oldRecovery);
    } catch { /* Preserve original failure even if localStorage quota prevents rollback. */ }
    throw new Error("Falha ao salvar a restauração no navegador. Seus dados anteriores foram recuperados quando possível.");
  }
}

export function recoveryIsAvailable(uid: string, storage: Pick<Storage, "getItem">): boolean {
  return storage.getItem(recoveryStorageKey(uid)) !== null;
}

/** One-step undo of the most recent cloud restoration, with rollback on failure. */
export function undoCloudRestore(uid: string, storage: RecoverableStorage): void {
  const raw = storage.getItem(recoveryStorageKey(uid));
  if (!raw) throw new Error("Nenhum backup anterior disponível.");
  let saved: RecoveryPayload;
  try {
    saved = JSON.parse(raw);
    if (typeof saved !== "object" || !saved || (saved.offers !== null && typeof saved.offers !== "string")
      || (saved.rules !== null && typeof saved.rules !== "string") || typeof saved.savedAt !== "string") throw new Error();
    validateRecovery(saved);
  } catch { throw new Error("Backup de recuperação inválido."); }
  const previousOffers = storage.getItem(storageKey(uid));
  const previousRules = storage.getItem(scheduleKey(uid));
  try {
    writeBoth(storage, uid, saved.offers, saved.rules);
    storage.removeItem(recoveryStorageKey(uid));
  } catch {
    try { writeBoth(storage, uid, previousOffers, previousRules); } catch {}
    throw new Error("Não foi possível desfazer a restauração.");
  }
}
