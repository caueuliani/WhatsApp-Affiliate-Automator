import { test } from "node:test";
import { strict as assert } from "node:assert";
import { describeGoogleLoginError } from "../src/auth/loginErrors";

test("exibe causa real ao invés de assumir domínio em toda falha", () => {
  const e = describeGoogleLoginError({ code: "auth/popup-blocked", message: "detalhes internos" });
  assert.equal(e.code, "auth/popup-blocked");
  assert.match(e.message, /pop-ups/i);
  assert.doesNotMatch(e.message, /domínio/i);
  assert.doesNotMatch(e.message, /detalhes internos/i);
});

test("erros de domínio e provedor possuem instruções diferentes", () => {
  const domain = describeGoogleLoginError({ code: "auth/unauthorized-domain" });
  const provider = describeGoogleLoginError({ code: "auth/operation-not-allowed" });
  assert.match(domain.message, /endereço/i);
  assert.match(provider.message, /desativado/i);
});

test("não reflete mensagens não confiáveis nem códigos arbitrários", () => {
  const unsafe = describeGoogleLoginError({ code: "javascript:alert(1)", message: "segredo-do-usuario" });
  assert.equal(unsafe.code, "auth/unknown");
  assert.doesNotMatch(unsafe.message, /segredo|javascript/i);
  const empty = describeGoogleLoginError(null);
  assert.equal(empty.code, "auth/unknown");
});
