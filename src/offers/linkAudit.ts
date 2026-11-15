import { parseMercadoLivreLink } from "./mercadoLivre";
import type { OfferDraft } from "./library";

export type LinkAuditSeverity = "compatible" | "review";
export type LinkAuditReason =
  | "missing" | "unsafe_url" | "not_mercado_livre" | "product_url"
  | "identical_link" | "shared_product";
export type LinkAuditRow = {
  id: string;
  title: string;
  host: string | null;
  severity: LinkAuditSeverity;
  reasons: LinkAuditReason[];
  /** This means only URL/host shape, not verified affiliate attribution. */
  shape: "share" | "product" | "other" | "missing";
};
export type AffiliateLinkAudit = {
  inspected: number;
  compatible: number;
  attention: number;
  rows: LinkAuditRow[];
};

export const LINK_AUDIT_LABELS: Record<LinkAuditReason, string> = {
  missing: "A oferta não possui link.",
  unsafe_url: "Endereço inválido ou com formato inseguro; revise manualmente.",
  not_mercado_livre: "O domínio não é um endereço oficial reconhecido do Mercado Livre.",
  product_url: "Link comum de produto: confirme na Central que é um link de afiliado.",
  identical_link: "Outra oferta usa exatamente o mesmo link; confirme se a duplicação foi intencional.",
  shared_product: "Outra oferta pode apontar para o mesmo produto; campanhas diferentes não foram mescladas.",
};

/** Read-only, offline check. Does NOT prove affiliate tracking, redirects, availability or commissions. */
export function auditAffiliateLinks(offers: readonly OfferDraft[]): AffiliateLinkAudit {
  const exact = new Map<string, number>();
  const productIds = new Map<string, Set<string>>();
  for (const offer of offers) {
    if (offer.link) exact.set(offer.link, (exact.get(offer.link) ?? 0) + 1);
    if (offer.affiliateProgram === "mercado_livre" && offer.link) {
      try {
        const itemId = parseMercadoLivreLink(offer.link).itemId;
        if (itemId) {
          const links = productIds.get(itemId) ?? new Set<string>();
          links.add(offer.link);
          productIds.set(itemId, links);
        }
      } catch { /* Invalid address will be marked for review below. */ }
    }
  }
  const rows = offers.map((offer): LinkAuditRow => {
    const reasons: LinkAuditReason[] = [];
    let host: string | null = null;
    let shape: LinkAuditRow["shape"] = "other";
    if (!offer.link) {
      shape = "missing";
      reasons.push("missing");
    } else {
      try {
        const parsed = new URL(offer.link);
        host = parsed.hostname.toLowerCase();
        if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port ||
          /\s|[\u0000-\u001f\u007f]/.test(offer.link)) {
          reasons.push("unsafe_url");
        } else if (offer.affiliateProgram === "mercado_livre") {
          try {
            const ml = parseMercadoLivreLink(offer.link);
            shape = ml.linkKind;
            if (ml.linkKind === "product") reasons.push("product_url");
            // IDs are hints only. Never merge/rewrite affiliate campaigns based on a product ID.
            if (ml.itemId && (productIds.get(ml.itemId)?.size ?? 0) > 1) reasons.push("shared_product");
          } catch {
            reasons.push("not_mercado_livre");
          }
        }
      } catch { reasons.push("unsafe_url"); }
      if ((exact.get(offer.link) ?? 0) > 1) reasons.push("identical_link");
    }
    const severe = reasons.some(reason => reason !== "shared_product");
    return { id: offer.id, title: offer.title, host, severity: severe ? "review" : "compatible", reasons, shape };
  });
  return {
    inspected: rows.length,
    compatible: rows.filter(row => row.severity === "compatible").length,
    attention: rows.filter(row => row.severity === "review").length,
    rows,
  };
}

/** Safe to paste into a bug report: excludes URLs, query parameters and tracking labels. */
export function linkAuditTextReport(report: AffiliateLinkAudit): string {
  const lines = [
    "Auditoria local de links — Affiliate Operator",
    "Verificação de formato/domínio; NÃO confirma comissões, disponibilidade, redirecionamentos ou rastreamento.",
    "Total: " + report.inspected + " | Precisam de revisão: " + report.attention,
    "",
  ];
  for (const row of report.rows) {
    const label = row.severity === "review" ? "REVISAR" : "FORMATO COMPATÍVEL";
    // Deliberately exclude product title and URL to avoid leaking user data via reports.
    lines.push(row.id + " — " + label + " — " + (row.reasons.join(", ") || "sem alertas de formato"));
  }
  return lines.join("\n");
}
