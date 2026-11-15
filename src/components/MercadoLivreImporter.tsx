import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardPaste, ExternalLink, Link2, ListChecks, Loader2, Search, ShieldAlert } from "lucide-react";
import { extractMercadoLivreOffers, MAX_ML_IMPORT_TEXT, type MercadoLivreCandidate } from "../offers/mercadoLivre";
import type { MercadoLivreReviewRow } from "../offers/mercadoLivreBatch";

type Props = {
  existingLinks: string[];
  initialSharedText?: string;
  onSharedHandled?: () => void;
  onReview: (candidate: MercadoLivreCandidate) => void;
  onEditExisting: (link: string) => void;
  onBatchSave: (rows: MercadoLivreReviewRow[]) => number;
};

type Reviewed = { selected: boolean; title: string };

export default function MercadoLivreImporter({ existingLinks, initialSharedText, onSharedHandled, onReview, onEditExisting, onBatchSave }: Props) {
  const [raw, setRaw] = useState("");
  const [candidates, setCandidates] = useState<MercadoLivreCandidate[]>([]);
  const [review, setReview] = useState<Record<string, Reviewed>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [readingClipboard, setReadingClipboard] = useState(false);
  const existing = useMemo(() => new Set(existingLinks), [existingLinks]);

  const resetReview = (found: MercadoLivreCandidate[]) => {
    setCandidates(found);
    setReview(Object.fromEntries(found.map(candidate => [candidate.link, { selected: false, title: candidate.titleSuggestion }])));
  };

  useEffect(() => {
    if (!initialSharedText) return;
    setRaw(initialSharedText);
    setError("");
    try {
      const found = extractMercadoLivreOffers(initialSharedText);
      resetReview(found);
      setNotice("Compartilhado do celular: " + found.length + (found.length === 1 ? " link pronto para revisão." : " links prontos para revisão."));
    } catch (cause) {
      resetReview([]);
      setError(cause instanceof Error ? cause.message : "Conteúdo compartilhado inválido.");
    }
    onSharedHandled?.();
  }, [initialSharedText]);

  const analyze = (event: React.FormEvent) => {
    event.preventDefault();
    setError(""); setNotice("");
    try {
      const found = extractMercadoLivreOffers(raw);
      resetReview(found);
      setNotice(found.length + (found.length === 1 ? " link encontrado." : " links encontrados.") + " Confira e selecione os produtos.");
    } catch (cause) {
      resetReview([]);
      setError(cause instanceof Error ? cause.message : "Falha ao analisar links.");
    }
  };

  const paste = async () => {
    setReadingClipboard(true);
    setError(""); setNotice("");
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) throw new Error("A área de transferência está vazia.");
      if (text.length > MAX_ML_IMPORT_TEXT) throw new Error("Conteúdo maior que 12 mil caracteres.");
      setRaw(text);
      resetReview([]);
      setNotice("Texto colado. Toque em Analisar links.");
    } catch {
      setError("Não foi possível ler a área de transferência. Cole manualmente no campo acima.");
    } finally { setReadingClipboard(false); }
  };

  const changeReview = (link: string, patch: Partial<Reviewed>) => {
    setReview(previous => ({ ...previous, [link]: { ...previous[link], ...patch } }));
    setError("");
  };

  const selectReviewable = () => {
    setReview(previous => Object.fromEntries(candidates.map(candidate => {
      const item = previous[candidate.link] ?? { selected: false, title: candidate.titleSuggestion };
      const validTitle = item.title.trim() && item.title.trim() !== "Produto do Mercado Livre (revisar)";
      return [candidate.link, { ...item, selected: !existing.has(candidate.link) && Boolean(validTitle) }];
    })));
    setError("");
  };

  const selectedCount = candidates.filter(candidate => !existing.has(candidate.link) && review[candidate.link]?.selected).length;
  const saveBatch = () => {
    if (!selectedCount) { setError("Marque ao menos uma oferta."); return; }
    if (!window.confirm("Salvar " + selectedCount + " ofertas na biblioteca deste navegador? Confirme os nomes e links. Preços, disponibilidade e comissão devem ser verificados no Mercado Livre.")) return;
    setError(""); setNotice("");
    try {
      const rows: MercadoLivreReviewRow[] = candidates.map(candidate => ({
        candidate,
        selected: Boolean(review[candidate.link]?.selected && !existing.has(candidate.link)),
        title: review[candidate.link]?.title ?? candidate.titleSuggestion,
      }));
      const count = onBatchSave(rows);
      setReview(previous => Object.fromEntries(Object.entries(previous).map(([link, item]) => [link, { ...item, selected: false }])));
      setNotice(count + (count === 1 ? " oferta salva na biblioteca." : " ofertas salvas na biblioteca.") + " Os links foram preservados; confira os dados antes de publicar.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o lote.");
    }
  };

  return <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm" aria-labelledby="ml-importer-heading">
    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 p-4 sm:p-6">
      <div className="flex items-center gap-2 text-amber-800">
        <Search size={21} className="shrink-0"/>
        <p className="text-xs font-extrabold uppercase tracking-wide">Mercado Livre · Importação assistida</p>
      </div>
      <h2 id="ml-importer-heading" className="mt-2 text-xl font-extrabold text-slate-950">Importar links da Central de Afiliados</h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">
        Gere os links na <strong>sua conta de afiliado</strong>, compartilhe para o Affiliate Operator no Android ou cole vários links aqui. Você pode revisar e salvar até 20 de uma vez, mantendo o rastreamento original.
      </p>
    </div>
    <form className="space-y-4 p-4 sm:p-6" onSubmit={analyze}>
      <label htmlFor="mercado-livre-paste" className="block text-sm font-semibold text-slate-900">Links ou mensagens de compartilhamento</label>
      <textarea id="mercado-livre-paste" rows={3} maxLength={MAX_ML_IMPORT_TEXT} value={raw}
        onChange={event => { setRaw(event.target.value); resetReview([]); setError(""); setNotice(""); }}
        placeholder={"https://meli.la/...\nOu cole a mensagem compartilhada pelo Mercado Livre"}
        className="field-control resize-y" spellCheck={false} autoCapitalize="none" autoCorrect="off" aria-describedby="ml-import-help"/>
      <p id="ml-import-help" className="text-xs leading-5 text-slate-600">
        Aceitamos links oficiais <code>meli.la</code> e <code>mercadolivre.com</code>. Não precisamos de senha, cookies ou sessão do Mercado Livre.
      </p>
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <button type="button" onClick={() => void paste()} disabled={readingClipboard}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {readingClipboard ? <Loader2 size={18} className="animate-spin"/> : <ClipboardPaste size={18}/>} Colar do celular
        </button>
        <button type="submit" disabled={!raw.trim()}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-extrabold text-amber-950 hover:bg-amber-400 disabled:opacity-50">
          <Search size={18}/> Analisar links
        </button>
      </div>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-900">{notice}</p>}
      {candidates.length > 0 && <div className="space-y-3" aria-label="Links encontrados">
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold text-indigo-900"><ListChecks size={18}/> Revisão em lote</p>
              <p className="mt-1 text-xs leading-5 text-indigo-800">{selectedCount} selecionadas de {candidates.length}. Os nomes são sugestões; confira no anúncio.</p>
            </div>
            <button type="button" onClick={selectReviewable} className="min-h-11 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100">
              Selecionar com nome
            </button>
          </div>
          <button type="button" onClick={saveBatch} disabled={!selectedCount}
            className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
            <ListChecks size={18}/> Salvar {selectedCount} {selectedCount === 1 ? "selecionada" : "selecionadas"}
          </button>
          <p className="mt-2 text-xs leading-5 text-indigo-800">Salvar não publica ofertas. Os dados ficam neste navegador até você enviar um backup ao D1.</p>
        </div>
        {candidates.map((item, i) => {
          const saved = existing.has(item.link);
          const title = review[item.link]?.title ?? item.titleSuggestion;
          return <article key={item.link} className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-slate-500">Oferta {i + 1} de {candidates.length}</p>
                <p className="mt-1 break-words text-sm font-bold text-slate-900">{title}</p>
              </div>
              {saved ? <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-800">Já salva</span>
                : <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-900">{item.linkKind === "share" ? "Compartilhado" : "Link direto"}</span>}
            </div>
            <p className="break-all font-mono text-xs leading-5 text-indigo-800">{item.link}</p>
            {item.linkKind === "product" && <p className="flex items-start gap-2 text-xs leading-5 text-amber-900">
              <ShieldAlert size={15} className="mt-0.5 shrink-0"/> Link comum de produto: confirme que foi gerado na sua conta de afiliado antes de divulgar.
            </p>}
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
              <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-slate-800">
                <input type="checkbox" className="h-5 w-5 accent-indigo-600" disabled={saved}
                  checked={saved ? false : Boolean(review[item.link]?.selected)}
                  onChange={event => changeReview(item.link, { selected: event.target.checked })}/>
                {saved ? "Já cadastrada" : "Selecionar para o lote"}
              </label>
              <label className="block space-y-1 text-sm font-semibold text-slate-800">
                <span>Nome do produto (revisar)</span>
                <input type="text" maxLength={120} disabled={saved} className="field-control"
                  value={title} onChange={event => changeReview(item.link, { title: event.target.value })}/>
              </label>
              {!saved && title.trim() === "Produto do Mercado Livre (revisar)" && <p className="text-xs text-amber-800">Preencha o nome real antes de salvar.</p>}
            </div>
            <div className="grid gap-2 sm:flex sm:items-center">
              <button type="button" onClick={() => saved ? onEditExisting(item.link) : onReview(item)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">
                {saved ? <CheckCircle2 size={17}/> : <ArrowRight size={17}/>}
                {saved ? "Editar oferta salva" : "Revisar individualmente"}
              </button>
              <a href={item.link} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                Conferir destino <ExternalLink size={15}/>
              </a>
            </div>
          </article>;
        })}
      </div>}
      <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-700">
        <Link2 size={17} className="mt-0.5 shrink-0 text-slate-500"/>
        <p><strong>Importante:</strong> importar um link não comprova comissão nem preço. O sistema não acessa sua conta nem consulta descontos automaticamente. Confira os dados antes de publicar.</p>
      </div>
    </form>
  </section>;
}
