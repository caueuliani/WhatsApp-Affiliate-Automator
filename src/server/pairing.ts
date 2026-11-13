/** Código de vinculação somente para contas explicitamente autorizadas. */
export const PAIRING_CODE_COOLDOWN_MS = 60_000;

export function validatePairingPhone(value: unknown): string {
  if (typeof value !== "string" || !/^[1-9][0-9]{9,14}$/.test(value)) {
    throw new Error("Informe o telefone com código do país e DDD, somente números (ex.: 5511999999999).");
  }
  return value;
}

export function pairingRetrySeconds(lastAttemptMs: number | undefined, now = Date.now()): number {
  if (lastAttemptMs === undefined) return 0;
  return Math.max(0, Math.ceil((PAIRING_CODE_COOLDOWN_MS - (now - lastAttemptMs)) / 1000));
}
