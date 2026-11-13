import { test } from "node:test";
import { strict as assert } from "node:assert";
import { incomingShareToText, isShareHandle, parseIncomingShare } from "../src/offers/shareTarget";
import { extractMercadoLivreOffers } from "../src/offers/mercadoLivre";

test("accepts Android shared title/link and preserves tracked affiliate URL", () => {
 const shared = parseIncomingShare({
   title: "Headset gamer",
   text: "Oferta de hoje",
   url: "https://meli.la/abc123?tracking=orig%2Binal"
 });
 const offers = extractMercadoLivreOffers(incomingShareToText(shared));
 assert.equal(offers.length, 1);
 assert.equal(offers[0].link, "https://meli.la/abc123?tracking=orig%2Binal");
 assert.equal(offers[0].titleSuggestion, "Oferta de hoje");
});
test("shared content has strict shape and bounded size", () => {
 assert.throws(() => parseIncomingShare({ title: 32, text: "x", url: "" }));
 assert.throws(() => parseIncomingShare({ title: "", text: "", url: "" }));
 assert.throws(() => parseIncomingShare({ title: "x".repeat(12001), text: "", url: "" }));
 assert.equal(isShareHandle("c244e2d5-4cbb-42d4-8b52-6b07ae1cc007"), true);
 assert.equal(isShareHandle("../?token=secret"), false);
});
