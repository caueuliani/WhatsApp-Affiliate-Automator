import { test } from "node:test";
import { strict as assert } from "node:assert";
import { authorizedEmails, isAuthorized, validateOffer, checkSendThrottle } from "../src/server/validation";

test("allowlist normalizes emails and fails closed", () => {
  assert.equal(authorizedEmails(undefined).size, 0);
  const emails = authorizedEmails(" Operator@Example.com, other@example.com ");
  assert.equal(isAuthorized("operator@example.com", true, emails), true);
  assert.equal(isAuthorized("unknown@example.com", true, emails), false);
  assert.equal(isAuthorized("operator@example.com", false, emails), false);
});

test("only group destinations are allowed", () => {
  assert.throws(() => validateOffer({ grupoId: "5511999999999@s.whatsapp.net", mensagem: "Oferta" }));
  assert.throws(() => validateOffer({ grupoId: "5511999999999", mensagem: "Oferta" }));
  assert.equal(validateOffer({ grupoId: "120363000000000000@g.us", mensagem: "Oferta" }).grupoId, "120363000000000000@g.us");
});

test("message and URL validation", () => {
  assert.throws(() => validateOffer({ grupoId: "120363000000000000@g.us", mensagem: "" }));
  assert.throws(() => validateOffer({ grupoId: "120363000000000000@g.us", mensagem: "A".repeat(3001) }));
  assert.throws(() => validateOffer({ grupoId: "120363000000000000@g.us", mensagem: "Oferta", link: "javascript:alert(1)" }));
  assert.throws(() => validateOffer({ grupoId: "120363000000000000@g.us", mensagem: "Oferta", link: "http://example.com" }));
  assert.equal(validateOffer({ grupoId: "120363000000000000@g.us", mensagem: "Oferta", link: "https://exemplo.com/p" }).text, "Oferta\n\nhttps://exemplo.com/p");
});

test("throttle enforces minimum interval and hourly cap", () => {
  const now = 10_000_000;
  assert.equal(checkSendThrottle([], now).allowed, true);
  assert.equal(checkSendThrottle([now - 1000], now).allowed, false);
  assert.equal(checkSendThrottle([now - 60_000], now).allowed, true);
  assert.equal(checkSendThrottle(Array.from({ length: 10 }, (_, i) => now - 100_000 - i * 1000), now).allowed, false);
});
