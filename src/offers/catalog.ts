import {
  isOfferCategory, scheduledState, type AffiliateProgram, type OfferCategory, type OfferDraft
} from "./library";

export type CatalogStatus = "all" | "due" | "upcoming" | "unscheduled";
export type CatalogSort = "planned" | "recent" | "title" | "price_low" | "price_high";
export type CatalogProgram = AffiliateProgram | "all";
export type CatalogCategory = OfferCategory | "all";

export type CatalogFilters = {
  query: string;
  status: CatalogStatus;
  program: CatalogProgram;
  category: CatalogCategory;
  sort: CatalogSort;
};

export const DEFAULT_CATALOG_FILTERS: CatalogFilters = {
  query: "", status: "all", program: "all", category: "all", sort: "planned",
};

const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

function searchText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

/** Read-only catalog projection. Does not sort/mutate offers in localStorage. */
export function filterCatalog(offers: readonly OfferDraft[], filters: CatalogFilters, now = new Date()): OfferDraft[] {
  const terms = searchText(filters.query).trim().split(/\s+/).filter(Boolean);
  return offers.filter(offer => {
    if (filters.status !== "all" && scheduledState(offer, now) !== filters.status) return false;
    if (filters.program !== "all" && (offer.affiliateProgram ?? "other") !== filters.program) return false;
    if (filters.category !== "all" && (offer.category ?? "outros") !== filters.category) return false;
    if (!terms.length) return true;
    const haystack = searchText([offer.title, offer.message, offer.trackingLabel || "", offer.link].join(" "));
    return terms.every(term => haystack.includes(term));
  }).sort((a, b) => {
    if (filters.sort === "title") {
      return collator.compare(a.title, b.title) || collator.compare(a.id, b.id);
    }
    if (filters.sort === "recent") {
      return b.updatedAt.localeCompare(a.updatedAt) || collator.compare(a.id, b.id);
    }
    if (filters.sort === "price_low" || filters.sort === "price_high") {
      // Unverified/missing prices always sort last, in either direction.
      const aPrice = a.priceCents, bPrice = b.priceCents;
      if (aPrice === null) return bPrice === null ? collator.compare(a.title,b.title) : 1;
      if (bPrice === null) return -1;
      return (filters.sort === "price_low" ? aPrice - bPrice : bPrice - aPrice)
        || collator.compare(a.title, b.title);
    }
    // Preserve previous default: scheduled first, soonest first, then latest edit.
    return (a.plannedAt || "9999").localeCompare(b.plannedAt || "9999")
      || b.updatedAt.localeCompare(a.updatedAt) || collator.compare(a.id, b.id);
  });
}

export function categorizeOffers(
  offers: readonly OfferDraft[],
  selectedIds: ReadonlySet<string>,
  category: OfferCategory,
  now = new Date()
): OfferDraft[] {
  if (!isOfferCategory(category)) throw new Error("Categoria inválida.");
  if (!selectedIds.size) throw new Error("Selecione ao menos uma oferta.");
  const known = new Set(offers.map(offer => offer.id));
  if ([...selectedIds].some(id => !known.has(id))) {
    throw new Error("A seleção mudou. Recarregue o catálogo antes de aplicar.");
  }
  const stamp = now.toISOString();
  return offers.map(offer => selectedIds.has(offer.id) && (offer.category ?? "outros") !== category
    ? { ...offer, category, updatedAt: stamp }
    : offer);
}
