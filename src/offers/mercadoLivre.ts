import type { DraftInput } from "./library";

export const MAX_ML_IMPORT_ITEMS = 20;
export const MAX_ML_IMPORT_TEXT = 12_000;

export type MercadoLivreCandidate = {
  link: string;
  titleSuggestion: string;
  itemId: string | null;
  linkKind: "share" | "product";
};

/** Recognizes only official Mercado Livre / meli.la hosts; no redirects or scraping. */
export function isMercadoLivreHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "meli.la"
    || host === "mercadolivre.com.br" || host.endsWith(".mercadolivre.com.br")
    || host === "mercadolivre.com" || host.endsWith(".mercadolivre.com");
}

export function parseMercadoLivreLink(text: string): Pick<MercadoLivreCandidate, "link" | "itemId" | "linkKind"> {
  const raw = text.trim();
  if (!raw || raw.length > 2048) throw new Error("Link vazio ou maior que 2.048 caracteres.");
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Link inválido: cole o endereço completo HTTPS do Mercado Livre."); }
  if (url.protocol !== "https:" || !!url.username || !!url.password || !!url.port || !isMercadoLivreHost(url.hostname)) {
    throw new Error("Use um link HTTPS oficial do Mercado Livre ou meli.la, sem autenticação embutida.");
  }
  if (/[\u0000-\u001f]/.test(raw)) throw new Error("Link contém caracteres inválidos.");
  if (url.pathname === "/" && !url.search) throw new Error("Cole um link de produto ou compartilhamento, não a página inicial.");
  const itemIdMatch = decodeURIComponent(url.pathname + url.search).match(/(?:^|[^A-Z0-9])(MLB-?\d{6,})(?=$|[^A-Z0-9])/i);
  const itemId = itemIdMatch ? itemIdMatch[1].toUpperCase().replace("-", "") : null;
  const linkKind = url.hostname.toLowerCase() === "meli.la" || /^\/sec(?:\/|$)/i.test(url.pathname) ? "share" : "product";
  // The original URL is not expanded, shortened, stripped of query params or retagged.
  return { link: raw, itemId, linkKind };
}

function meaningfulLine(segment: string): string | null {
  const lines = segment.split(/\r?\n/).map(s => s.trim()).filter(Boolean).reverse();
  for (const line of lines) {
    const value = line.replace(/^[\s•*-]+/, "").trim();
    if (!value || value.length < 4 || value.length > 120 || /^https?:\/\//i.test(value)
      || /^R\$\s*[\d.,]+$/i.test(value)
      || /^(?:olha|confira|achei|veja|link de afiliado|compartilhar|mercado livre)[\s!:.,]*$/i.test(value)) continue;
    return value;
  }
  return null;
}

function titleFromProductLink(link: string): string | null {
  const url = new URL(link);
  if (url.hostname === "meli.la" || /^\/sec(?:\/|$)/i.test(url.pathname)) return null;
  const first = url.pathname.split("/").filter(Boolean).find(part => !/^MLB-?\d+$/i.test(part) && !/^(?:p|produto|item|MLB)$/i.test(part));
  if (!first || !first.includes("-")) return null;
  let title: string;
  try { title = decodeURIComponent(first); } catch { return null; }
  title = title.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  return title.length >= 6 ? title.charAt(0).toUpperCase() + title.slice(1) : null;
}

/** Ingests pasted messages or up to 20 links without network requests. */
export function extractMercadoLivreOffers(text: string): MercadoLivreCandidate[] {
  if (text.length > MAX_ML_IMPORT_TEXT) throw new Error("Cole até 12 mil caracteres por importação.");
  const candidates: MercadoLivreCandidate[] = [];
  const seen = new Set<string>();
  // URLs from sharing sheet/WhatsApp; ignore anything that isn't an official ML host.
  const matches = [...text.matchAll(/https?:\/\/[^\s<>"']+/gi)];
  // Also accept bare meli.la shortcuts, as often copied from a mobile sharing sheet.
  if (matches.length === 0) {
    for (const m of text.matchAll(/(?:^|[\s(])((?:www\.)?meli\.la\/[a-zA-Z0-9][^\s<>"']*)/gim)) {
      matches.push(Object.assign([m[1]], { index: m.index === undefined ? 0 : m.index + m[0].indexOf(m[1]) }) as RegExpMatchArray);
    }
  }
  for (const match of matches) {
    // Remove punctuation added by messaging apps, never remove query parameters.
    const raw = match[0].replace(/[)\].,;!]+$/g, "");
    const possible = /^https:\/\//i.test(raw) ? raw : "https://" + raw;
    let parsed: ReturnType<typeof parseMercadoLivreLink>;
    try { parsed = parseMercadoLivreLink(possible); } catch { continue; }
    if (seen.has(parsed.link)) continue;
    if (candidates.length >= MAX_ML_IMPORT_ITEMS) throw new Error("Limite de 20 links por importação. Divida em lotes menores.");
    seen.add(parsed.link);
    const pre = text.slice(Math.max(0, (match.index || 0) - 180), match.index || 0);
    // A preceding full URL is not a title for the next product.
    const tail = pre.split(/https?:\/\/[^\s]+/i).at(-1) || "";
    const hint = meaningfulLine(tail) || titleFromProductLink(parsed.link) || "Produto do Mercado Livre (revisar)";
    candidates.push({ ...parsed, titleSuggestion: hint });
  }
  if (!candidates.length) throw new Error("Nenhum link oficial do Mercado Livre encontrado. Copie um link meli.la ou mercadolivre.com/sec gerado na sua conta de afiliado.");
  return candidates;
}

export function createImportDraft(candidate: MercadoLivreCandidate): DraftInput {
  const title = candidate.titleSuggestion.slice(0, 120);
  return {
    title,
    message: title + "\n\nConfira o preço e a disponibilidade atuais no Mercado Livre.\n\nPublicidade: este link pode gerar comissão para quem divulga.",
    link: candidate.link,
    price: "",
    affiliateProgram: "mercado_livre",
    trackingLabel: "",
    plannedAt: "",
  };
}
