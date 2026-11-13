import { parseLibrary, scheduledState } from "../offers/library";

export type OfferSummary = { total: number; due: number; upcoming: number };

export function getOfferSummary(raw: string | null, now = new Date()): OfferSummary {
  const empty: OfferSummary = { total: 0, due: 0, upcoming: 0 };
  if (!raw) return empty;
  try {
    const offers = parseLibrary(raw);
    return {
      total: offers.length,
      due: offers.filter(offer => scheduledState(offer, now) === "due").length,
      upcoming: offers.filter(offer => scheduledState(offer, now) === "upcoming").length,
    };
  } catch {
    return empty;
  }
}
