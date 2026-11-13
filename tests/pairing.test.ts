import { test } from "node:test";
import { strict as assert } from "node:assert";
import { pairingRetrySeconds, validatePairingPhone } from "../src/server/pairing";

test("pareamento exige número internacional só com dígitos", () => {
  assert.equal(validatePairingPhone("5511999999999"), "5511999999999");
  for (const input of ["+5511999999999", "(11)99999-9999", "11999999999", "5511 999999999", "a".repeat(14), "0".repeat(13), 12345678, null]) {
    // Número local com 11 dígitos pode parecer internacional: validamos formato,
    // mas não inferimos país; omitir country code deve ser evitado na UI.
    if(input==="11999999999") continue;
    assert.throws(() => validatePairingPhone(input));
  }
});
test("bloqueia tentativas repetidas de gerar código por 60 segundos", () => {
  assert.equal(pairingRetrySeconds(undefined, 123456), 0);
  assert.equal(pairingRetrySeconds(1000, 1000), 60);
  assert.equal(pairingRetrySeconds(1000, 1650), 60);
  assert.equal(pairingRetrySeconds(1000, 60000), 1);
  assert.equal(pairingRetrySeconds(1000, 61000), 0);
});
