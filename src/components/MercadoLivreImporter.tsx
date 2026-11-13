import React, { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardPaste, ExternalLink, Link2, Loader2, Search, ShieldAlert } from "lucide-react";
import { extractMercadoLivreOffers, MAX_ML_IMPORT_TEXT, type MercadoLivreCandidate } from "../offers/mercadoLivre";

type Props = {
  existingLinks: string[];
  onReview: (candidate: MercadoLivreCandidate) => void;
  onEditExisting: (link: string) => void;
};

export default function MercadoLivreImporter({ existingLinks, onReview, onEditExisting }: Props) {
  const [raw, setRaw] = useState("");
  const [candidates, setCandidates] = useState<MercadoLivreCandidate[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [readingClipboard, setReadingClipboard] = useState(false);
  const existing = useMemo(() => new Set(existingLinks), [existingLinks]);
  const handleAnalyze = (event: React.FormEvent) => {
    event.preventDefault();
    setError(""); setNotice("");
    try {
      const found = extractMercadoLivreOffers(raw);
      setCandidates(found);
      setNotice(found.length + (found.length === 1 ? " link encontrado. Revise antes de salvar." : " links encontrados. Revise cada produto antes de salvar."));
    } catch (cause) {
      setCandidates([]);
      setError(cause instanceof Error ? cause.message : "Falha ao analisar links.");
    }
  };
  const paste = async () => {
    setReadingClipboard(true);
    setError(""); setNotice("");
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) throw new Error("A área de transferência está vazia.");
      if (text.length > MAX_ML_IMPORT_TEXT) throw new Error("Conteúdo maior que 12 mil caracteres. Copie um lote menor.");
      setRaw(text);
      setCandidates([]);
      setNotice("Texto colado. Toque em Analisar links para continuar.");
    } catch {
      setError("Não foi possível ler a área de transferência. Cole o texto manualmente no campo acima.");
    } finally {
      setReadingClipboard(false);
    }
  };

  return <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm" aria-labelledby="ml-importer-heading">
    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 p-4 sm:p-6">
      <div className="flex items-center gap-2 text-amber-800">
        <Search size={21} className="shrink-0"/>
        <p className="text-xs font-extrabold uppercase tracking-wide">Novo · Mercado Livre</p>
      </div>
      <h2 id="ml-importer-heading" className="mt-2 text-xl font-extrabold text-slate-950">Importar links da Central de Afiliados</h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">
        No Mercado Livre, gere o link pela <strong>sua conta de afiliado</strong>, copie a mensagem ou o endereço e cole aqui. Aceitamos um ou vários links por vez, sem modificar o rastreamento original.
      </p>
    </div>
    <form className="space-y-4 p-4 sm:p-6" onSubmit={handleAnalyze}>
      <label htmlFor="mercado-livre-paste" className="block text-sm font-semibold text-slate-900">Cole o link ou a mensagem de compartilhamento</label>
      <textarea id="mercado-livre-paste" rows={3} maxLength={MAX_ML_IMPORT_TEXT} value={raw}
        onChange={e => { setRaw(e.target.value); setCandidates([]); setError(""); setNotice(""); }}
        placeholder="https://meli.la/…&#10;ou cole a mensagem completa compartilhada pelo Mercado Livre"
        className="field-control resize-y" spellCheck={false} autoCapitalize="none" autoCorrect="off"
        aria-describedby="ml-import-help"/>
      <p id="ml-import-help" className="text-xs leading-5 text-slate-600">
        Links oficiais: <code>meli.la</code>, <code>mercadolivre.com/sec</code> e <code>mercadolivre.com.br</code>.
        Não precisamos da sua senha, sessão ou cookie do Mercado Livre.
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
        {candidates.map((item, i) => {
          const saved = existing.has(item.link);
          return <article key={item.link} className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-slate-500">Oferta {i + 1} de {candidates.length}</p>
                <p className="mt-1 break-words text-sm font-bold text-slate-900">{item.titleSuggestion}</p>
              </div>
              {saved ? <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-800">Já salva</span>
                : <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-900">{item.linkKind === "share" ? "Compartilhado" : "Link direto"}</span>}
            </div>
            <p className="break-all font-mono text-xs leading-5 text-indigo-800">{item.link}</p>
            {item.linkKind === "product" && <p className="flex items-start gap-2 text-xs leading-5 text-amber-900">
              <ShieldAlert size={15} className="mt-0.5 shrink-0"/> Link direto do produto: confira se foi gerado pela sua Central e contém o rastreamento de afiliado antes de salvar.
            </p>}
            <div className="grid gap-2 sm:flex sm:items-center">
              <button type="button" onClick={() => saved ? onEditExisting(item.link) : onReview(item)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">
                {saved ? <CheckCircle2 size={17}/> : <ArrowRight size={17}/>}
                {saved ? "Editar oferta salva" : "Revisar e salvar"}
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
        <p><strong>Importante:</strong> reconhecer um link não comprova comissão ou preço. O sistema não consulta sua conta, não segue redirecionamentos e não verifica descontos automaticamente. Confira o link, o produto, o preço e as regras do programa antes de publicar.</p>
      </div>
    </form>
  </section>;
}
