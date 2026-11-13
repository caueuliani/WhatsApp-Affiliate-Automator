export const MAX_OFFERS = 100;
export const LIBRARY_VERSION = 1;
export const storageKey = (uid: string) => "affiliate-operator:offers:v1:" + uid;

export type AffiliateProgram = "mercado_livre" | "shopee" | "amazon" | "other";

export interface OfferDraft {
  id: string;
  title: string;
  message: string;
  link: string;
  priceCents: number | null;
  /** Metadata only; never changes the original affiliate URL. */
  affiliateProgram?: AffiliateProgram;
  trackingLabel?: string;
  plannedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DraftInput {
  title: string;
  message: string;
  link: string;
  price: string;
  affiliateProgram?: AffiliateProgram;
  trackingLabel?: string;
  plannedAt: string;
}

export function normalizeAffiliateLink(input: string): string {
  if (!input.trim()) return "";
  if (input.length > 2048) throw new Error("O link deve ter no máximo 2.048 caracteres.");
  try {
    const parsed = new URL(input.trim());
    if (parsed.protocol !== "https:") throw new Error("Protocolo inseguro");
    return parsed.href;
  } catch {
    throw new Error("Use um link HTTPS válido para o produto.");
  }
}

export function createDraft(input: DraftInput, id: string, now = new Date()): OfferDraft {
  const title = input.title.trim();
  const message = input.message.trim();
  if (!title || title.length > 120) throw new Error("Informe um nome de até 120 caracteres.");
  if (!message || message.length > 3000) throw new Error("Informe uma descrição de até 3.000 caracteres.");
  const link = normalizeAffiliateLink(input.link);
  let priceCents: number | null = null;
  if (input.price.trim() !== "") {
    const numeric = Number(input.price.replace(",", "."));
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1_000_000) {
      throw new Error("Preço inválido.");
    }
    priceCents = Math.round(numeric * 100);
  }
  let plannedAt: string | null = null;
  if (input.plannedAt) {
    const parsed = new Date(input.plannedAt);
    if (!Number.isFinite(parsed.getTime())) throw new Error("Data de planejamento inválida.");
    plannedAt = parsed.toISOString();
  }

  const affiliateProgram = input.affiliateProgram || "other";
  if (!["mercado_livre", "shopee", "amazon", "other"].includes(affiliateProgram)) {
    throw new Error("Programa de afiliados desconhecido.");
  }
  const trackingLabel = (input.trackingLabel || "").trim();
  if (trackingLabel.length > 60 || /[\u0000-\u001F]/.test(trackingLabel)) {
    throw new Error("A etiqueta deve ter até 60 caracteres e não pode conter quebras de linha.");
  }
  return { id, title, message, link, priceCents, affiliateProgram, trackingLabel, plannedAt, createdAt: now.toISOString(), updatedAt: now.toISOString() };
}

export function scheduledState(offer: OfferDraft, now = new Date()): "unscheduled" | "upcoming" | "due" {
  if (!offer.plannedAt) return "unscheduled";
  return new Date(offer.plannedAt).getTime() <= now.getTime() ? "due" : "upcoming";
}

function isOffer(value: unknown): value is OfferDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const x = value as Record<string, unknown>;
  const validIso = (v: unknown) => typeof v === "string" && Number.isFinite(Date.parse(v));
  return typeof x.id === "string" && x.id.length > 0 && x.id.length <= 100
    && typeof x.title === "string" && x.title.length > 0 && x.title.length <= 120
    && typeof x.message === "string" && x.message.length > 0 && x.message.length <= 3000
    && typeof x.link === "string" && x.link.length <= 2048
    && (x.link === "" || (() => { try { return new URL(x.link as string).protocol === "https:"; } catch { return false; } })())
    && (x.priceCents === null || (Number.isInteger(x.priceCents) && (x.priceCents as number) >= 0 && (x.priceCents as number) <= 100000000))
    && (x.affiliateProgram === undefined || ["mercado_livre", "shopee", "amazon", "other"].includes(x.affiliateProgram as string))
    && (x.trackingLabel === undefined || (typeof x.trackingLabel === "string" && x.trackingLabel.length <= 60 && !/[\u0000-\u001F]/.test(x.trackingLabel)))
    && (x.plannedAt === null || validIso(x.plannedAt))
    && validIso(x.createdAt) && validIso(x.updatedAt);
}

export function parseLibrary(raw: string): OfferDraft[] {
  if (raw.length > 750_000) throw new Error("Arquivo de ofertas muito grande.");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error("JSON inválido."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Formato de backup inválido.");
  const doc = parsed as Record<string, unknown>;
  if (doc.version !== LIBRARY_VERSION || !Array.isArray(doc.offers) || doc.offers.length > MAX_OFFERS || !doc.offers.every(isOffer)) {
    throw new Error("Backup incompatível ou com ofertas inválidas.");
  }
  const ids = new Set(doc.offers.map(offer => offer.id));
  if (ids.size !== doc.offers.length) throw new Error("Backup possui identificadores repetidos.");
  return doc.offers;
}

export function exportLibrary(offers: OfferDraft[]): string {
  return JSON.stringify({ version: LIBRARY_VERSION, offers }, null, 2);
}
