import { createDraft, MAX_OFFERS, type OfferDraft } from "./library";
import { createImportDraft, parseMercadoLivreLink, type MercadoLivreCandidate } from "./mercadoLivre";

export type MercadoLivreReviewRow = {
  candidate: MercadoLivreCandidate;
  selected: boolean;
  /** Human-approved product name; never treated as verified metadata from Mercado Livre. */
  title: string;
};

/**
 * Builds a single review batch before any local persistence occurs.
 * Every selected row must be reviewed, non-duplicate, and within library limits.
 * No network access, scraping, affiliate link reconstruction, or auto-publication.
 */
export function prepareMercadoLivreBatch(
  rows: MercadoLivreReviewRow[],
  current: OfferDraft[],
  newId: () => string,
  now = new Date(),
): OfferDraft[] {
  const chosen = rows.filter(row => row.selected);
  if (chosen.length === 0) throw new Error("Selecione ao menos uma oferta para salvar.");
  if (current.length + chosen.length > MAX_OFFERS) {
    throw new Error("Limite de " + MAX_OFFERS + " ofertas na biblioteca. Remova ou deixe de selecionar alguns itens.");
  }
  const existing = new Set(current.map(offer => offer.link));
  const ids = new Set(current.map(offer => offer.id));
  const drafts: OfferDraft[] = [];

  for (const row of chosen) {
    const link = parseMercadoLivreLink(row.candidate.link).link;
    if (existing.has(link)) throw new Error("Este link já está na biblioteca ou aparece mais de uma vez no lote.");
    const title = row.title.trim();
    if (!title || title.length > 120 || title === "Produto do Mercado Livre (revisar)") {
      throw new Error("Revise o nome real de todos os produtos selecionados antes de salvar.");
    }
    const id = newId();
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || ids.has(id)) {
      throw new Error("Identificador de oferta inválido ou duplicado. Tente novamente.");
    }
    const input = createImportDraft({ ...row.candidate, titleSuggestion: title });
    const draft = createDraft({ ...input, title }, id, now);
    // Original affiliate link is validated above and preserved byte-for-byte.
    draft.link = link;
    drafts.push(draft);
    existing.add(link);
    ids.add(id);
  }

  return drafts;
}
