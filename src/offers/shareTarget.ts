/** Validate only the size/content shared from the Android OS. Recognition of ML links happens in mercadoLivre.ts. */
export type IncomingShare = { title: string; text: string; url: string };
export const MAX_SHARED_IMPORT = 12_000;

export function parseIncomingShare(value: unknown): IncomingShare {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Compartilhamento inválido.");
  const data = value as Record<string, unknown>;
  if (typeof data.title !== "string" || typeof data.text !== "string" || typeof data.url !== "string") {
    throw new Error("Compartilhamento incompleto.");
  }
  if (JSON.stringify(data).length > MAX_SHARED_IMPORT) throw new Error("Compartilhamento muito grande.");
  if (!data.title.trim() && !data.text.trim() && !data.url.trim()) throw new Error("Compartilhamento vazio.");
  return { title: data.title, text: data.text, url: data.url };
}
export function incomingShareToText(share: IncomingShare): string {
  const merged = [share.title, share.text, share.url].filter(Boolean).join("\n").trim();
  if (merged.length > MAX_SHARED_IMPORT) throw new Error("Compartilhamento muito grande.");
  return merged;
}
export function isShareHandle(value: string | null): value is string {
  return typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
}
