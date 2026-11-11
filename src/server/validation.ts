export const MAX_MESSAGE_LENGTH = 3000;
export const MAX_LINK_LENGTH = 2048;

export function authorizedEmails(raw: string | undefined): Set<string> {
  return new Set((raw || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean));
}

export function isAuthorized(email: string | undefined, verified: boolean | undefined, emails: Set<string>): boolean {
  return Boolean(verified && email && emails.has(email.toLowerCase()));
}

export type Offer = { grupoId: string; text: string };

export function validateOffer(input: unknown): Offer {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Dados da oferta inválidos.");
  }
  const body = input as Record<string, unknown>;
  const grupoId = body.grupoId;
  const mensagem = body.mensagem;
  const link = body.link;
  if (typeof grupoId !== "string" || !/^[^@\s]{5,80}@g\.us$/.test(grupoId)) {
    throw new Error("Selecione um grupo válido.");
  }
  if (typeof mensagem !== "string" || mensagem.trim().length === 0 || mensagem.length > MAX_MESSAGE_LENGTH) {
    throw new Error("A mensagem deve ter entre 1 e 3000 caracteres.");
  }
  if (link !== undefined && link !== "" && typeof link !== "string") {
    throw new Error("Link inválido.");
  }
  let cleanLink = "";
  if (typeof link === "string" && link.trim()) {
    if (link.length > MAX_LINK_LENGTH) throw new Error("Link muito longo.");
    try {
      const url = new URL(link.trim());
      if (url.protocol !== "https:") throw new Error();
      cleanLink = url.toString();
    } catch {
      throw new Error("Use um link HTTPS válido.");
    }
  }
  const text = mensagem.trim() + (cleanLink ? "\n\n" + cleanLink : "");
  if (text.length > MAX_MESSAGE_LENGTH + MAX_LINK_LENGTH + 2) {
    throw new Error("Oferta muito longa.");
  }
  return { grupoId, text };
}

export type SendThrottle = { allowed: boolean; retryAfterSeconds: number };
export function checkSendThrottle(sentAt: number[], now: number, maxPerHour = 10, minIntervalMs = 30000): SendThrottle {
  const recent = sentAt.filter(ts => ts > now - 3600000).sort((a, b) => a - b);
  if (recent.length >= maxPerHour) {
    return { allowed: false, retryAfterSeconds: Math.ceil((recent[0] + 3600000 - now) / 1000) };
  }
  const last = recent.at(-1);
  if (last !== undefined && now - last < minIntervalMs) {
    return { allowed: false, retryAfterSeconds: Math.ceil((minIntervalMs - (now - last)) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}
