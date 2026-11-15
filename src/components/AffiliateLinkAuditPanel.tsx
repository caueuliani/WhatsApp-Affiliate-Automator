import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCopy, ExternalLink, Link2 } from "lucide-react";
import { auditAffiliateLinks, LINK_AUDIT_LABELS, linkAuditTextReport } from "../offers/linkAudit";
import type { OfferDraft } from "../offers/library";

type Props = {
  offers: OfferDraft[];
  onEdit: (offer: OfferDraft) => void;
};

export default function AffiliateLinkAuditPanel({ offers, onEdit }: Props) {
  const report = useMemo(() => auditAffiliateLinks(offers), [offers]);
  const [issuesOnly, setIssuesOnly] = useState(true);
  const [feedback, setFeedback] = useState("");
  const visible = report.rows.filter(item => !issuesOnly || item.severity === "review");
  const offerById = useMemo(() => new Map(offers.map(offer => [offer.id, offer])), [offers]);

  const copyText = async (value: string, success: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback(success);
    } catch {
      setFeedback("Não foi possível copiar automaticamente. Verifique a permissão do navegador.");
    }
  };

  return <details className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Auditoria local de links de afiliado">
    <summary className="flex min-h-16 cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-900"><Link2 size={19}/> Auditoria dos links</h3>
        <p className="mt-1 text-xs leading-5 text-slate-600">Verificação local e sem acesso ao Mercado Livre; não confirma comissão, preço ou funcionamento do destino.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">{report.attention} para revisar</span>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">{report.compatible} com formato compatível</span>
      </div>
    </summary>
    <div className="space-y-4 border-t border-slate-100 px-4 pb-5 pt-4 sm:px-5">
      <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
        <strong>Atenção:</strong> endereço em domínio oficial não comprova que seja um link de afiliado válido. Confirme cada oferta na sua Central de Afiliados antes de divulgar. A verificação não abre links, não segue redirecionamentos e não muda parâmetros de rastreamento.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={issuesOnly} onChange={event => setIssuesOnly(event.target.checked)} className="h-5 w-5 accent-indigo-600"/>
          Mostrar só os que precisam de revisão
        </label>
        <button type="button" onClick={() => void copyText(linkAuditTextReport(report), "Resumo de auditoria copiado sem links nem dados de comissão.")}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">
          <ClipboardCopy size={17}/> Copiar resumo sem links
        </button>
      </div>
      {feedback && <p role="status" className="rounded-xl bg-indigo-50 p-3 text-xs text-indigo-900">{feedback}</p>}
      {report.inspected === 0 && <p className="text-sm text-slate-600">Nenhuma oferta cadastrada para auditar.</p>}
      {report.inspected > 0 && visible.length === 0 && <p className="text-sm text-slate-600">Nenhuma oferta exige atenção de formato. Isso não comprova atribuição de comissão.</p>}
      <div className="space-y-3">
        {visible.map(row => {
          const offer = offerById.get(row.id);
          if (!offer) return null;
          return <div key={row.id} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3" aria-label={"Auditoria de " + row.title}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words text-sm font-bold text-slate-900">{row.title}</p>
                <p className="mt-1 text-xs text-slate-600">Domínio: {row.host || "não identificado"}</p>
              </div>
              {row.severity === "review" ?
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900"><AlertTriangle size={14}/> Revisar</span> :
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-900"><CheckCircle2 size={14}/> Formato</span>}
            </div>
            {row.reasons.length > 0 ?
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-5 text-amber-900">
                {row.reasons.map(reason => <li key={reason}>{LINK_AUDIT_LABELS[reason]}</li>)}
              </ul> :
              <p className="mt-2 text-xs text-slate-600">Sem alertas locais de formato.</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => onEdit(offer)}
                className="min-h-11 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700">
                Revisar oferta
              </button>
              {offer.link && <button type="button" onClick={() => void copyText(offer.link, "Link original copiado sem alterações.")}
                className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-slate-100">
                <ClipboardCopy size={15}/> Copiar link original
              </button>}
              {offer.link && row.severity === "compatible" && <a href={offer.link} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
                className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100">
                Conferir destino manualmente <ExternalLink size={15}/>
              </a>}
            </div>
          </div>;
        })}
      </div>
      <p className="text-xs leading-5 text-slate-500">O diagnóstico é calculado na memória do navegador e não cria registros de auditoria no D1. Ações de revisão são sempre manuais.</p>
    </div>
  </details>;
}
