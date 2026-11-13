import React, { useEffect, useMemo, useState } from "react";
import { CalendarClock, Download, Edit3, FileUp, PackagePlus, Search, Trash2, Copy, ArrowRight, X } from "lucide-react";
import { createDraft, exportLibrary, MAX_OFFERS, parseLibrary, scheduledState, storageKey, type DraftInput, type OfferDraft } from "../offers/library";

type Props = { uid: string; onUse: (draft: OfferDraft) => void };
const empty: DraftInput = { title: "", message: "", link: "", price: "", affiliateProgram: "other", trackingLabel: "", plannedAt: "" };
function localDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const adjusted = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
}
function fromDraft(offer: OfferDraft): DraftInput {
  return { title: offer.title, message: offer.message, link: offer.link, price: offer.priceCents === null ? "" : String(offer.priceCents / 100), affiliateProgram: offer.affiliateProgram || "other", trackingLabel: offer.trackingLabel || "", plannedAt: localDateTime(offer.plannedAt) };
}
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function OfferLibrary({ uid, onUse }: Props) {
  const key = storageKey(uid);
  const [offers, setOffers] = useState<OfferDraft[]>(() => {
    try { return parseLibrary(localStorage.getItem(key) || exportLibrary([])); }
    catch { return []; }
  });
  const [form, setForm] = useState<DraftInput>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "due" | "upcoming">("all");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    try { localStorage.setItem(key, exportLibrary(offers)); }
    catch { setError("O navegador não conseguiu salvar as ofertas. Exporte um backup."); }
  }, [offers, key]);

  const visible = useMemo(() => offers
    .filter(offer => (filter === "all" || scheduledState(offer) === filter) && (offer.title + " " + offer.message).toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (a.plannedAt || "9999").localeCompare(b.plannedAt || "9999") || b.updatedAt.localeCompare(a.updatedAt)), [offers, filter, query]);

  const update = (field: keyof DraftInput, value: string) => setForm(previous => ({ ...previous, [field]: value }));
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setError(""); setNotice("");
    try {
      const current = editing ? offers.find(offer => offer.id === editing) : undefined;
      if (!current && offers.length >= MAX_OFFERS) throw new Error("Limite de 100 ofertas. Exclua uma oferta antes de cadastrar outra.");
      const draft = createDraft(form, current?.id || crypto.randomUUID());
      if (current) {
        draft.createdAt = current.createdAt;
        setOffers(previous => previous.map(offer => offer.id === current.id ? draft : offer));
      } else setOffers(previous => [draft, ...previous]);
      setEditing(null); setForm(empty);
      setNotice(current ? "Rascunho atualizado." : "Oferta salva na biblioteca deste navegador.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  };
  const edit = (offer: OfferDraft) => {
    setEditing(offer.id); setForm(fromDraft(offer)); setError(""); setNotice("");
    document.getElementById("offer-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const remove = (offer: OfferDraft) => {
    if (!window.confirm('Excluir a oferta "' + offer.title + '"?')) return;
    setOffers(previous => previous.filter(item => item.id !== offer.id));
    if (editing === offer.id) { setEditing(null); setForm(empty); }
    setNotice("Oferta excluída.");
  };
  const duplicate = (offer: OfferDraft) => {
    if (offers.length >= MAX_OFFERS) { setError("Limite de 100 ofertas atingido."); return; }
    const now = new Date().toISOString();
    setOffers(previous => [{ ...offer, id: crypto.randomUUID(), title: offer.title.slice(0, 110) + " (cópia)", plannedAt: null, createdAt: now, updatedAt: now }, ...previous]);
    setNotice("Oferta duplicada sem a data anterior.");
  };
  const exportBackup = () => {
    const url = URL.createObjectURL(new Blob([exportLibrary(offers)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "affiliate-operator-ofertas.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importBackup = async (file: File | undefined) => {
    if (!file) return;
    setError(""); setNotice("");
    if (file.size > 750_000) { setError("Backup excede 750 KB."); return; }
    try {
      const imported = parseLibrary(await file.text());
      if (!window.confirm("Substituir as " + offers.length + " ofertas atuais por " + imported.length + " ofertas do backup?")) return;
      setOffers(imported);
      setEditing(null); setForm(empty);
      setNotice("Backup importado. Confira as datas e os links antes de divulgar.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível importar o arquivo.");
    }
  };
  const due = offers.filter(offer => scheduledState(offer) === "due").length;
  const upcoming = offers.filter(offer => scheduledState(offer) === "upcoming").length;

  return <section className="space-y-5">
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
      <strong>Biblioteca e planejamento:</strong> as ofertas são armazenadas neste navegador, por conta Google. Datas são lembretes visuais: nenhuma mensagem é enviada automaticamente. Exporte um backup para usar em outro dispositivo.
    </div>
    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex gap-2 items-center text-sm font-medium text-slate-700"><CalendarClock size={18} /> {offers.length} ofertas · {due} planejadas vencidas · {upcoming} futuras</div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={exportBackup} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-slate-50"><Download size={15}/> Exportar</button>
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-1 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-slate-50">
          <FileUp size={15}/> Importar
          <input className="sr-only" aria-label="Importar backup JSON" type="file" accept=".json,application/json" onChange={e => { void importBackup(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }} />
        </label>
      </div>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 text-red-700 p-3 text-sm">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-emerald-50 text-emerald-800 p-3 text-sm">{notice}</p>}
    <form id="offer-editor" onSubmit={save} className="rounded-2xl border bg-white shadow-sm p-4 space-y-4 sm:p-5">
      <div className="flex items-center gap-2 justify-between">
        <h3 className="font-semibold text-lg flex items-center gap-2"><PackagePlus size={19}/> {editing ? "Editar oferta" : "Cadastrar oferta"}</h3>
        {editing && <button type="button" onClick={() => { setEditing(null); setForm(empty); }} className="text-sm inline-flex items-center gap-1 text-slate-500"><X size={16}/> Cancelar edição</button>}
      </div>
      <label className="block space-y-1"><span className="text-sm font-medium">Nome do produto</span>
        <input required maxLength={120} value={form.title} onChange={e => update("title", e.target.value)} placeholder="Ex.: Headset gamer em promoção" className="w-full rounded-lg border p-3" />
      </label>
      <label className="block space-y-1"><span className="text-sm font-medium">Texto da oferta (para o WhatsApp)</span>
        <textarea required maxLength={3000} rows={4} value={form.message} onChange={e => update("message", e.target.value)} placeholder="Descrição, condições e aviso de afiliado" className="w-full rounded-lg border p-3"/>
      </label>
      <label className="block space-y-1"><span className="text-sm font-medium">Link de afiliado (HTTPS)</span>
        <input maxLength={2048} type="url" value={form.link} onChange={e => update("link", e.target.value)} placeholder="https://..." className="w-full rounded-lg border p-3"/>
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block space-y-1"><span className="text-sm font-medium">Programa de afiliados</span>
          <select value={form.affiliateProgram || "other"} onChange={e => update("affiliateProgram", e.target.value)} className="w-full rounded-lg border p-3 bg-white">
            <option value="mercado_livre">Mercado Livre</option>
            <option value="shopee">Shopee</option>
            <option value="amazon">Amazon</option>
            <option value="other">Outro / não informado</option>
          </select>
        </label>
        <label className="block space-y-1"><span className="text-sm font-medium">Etiqueta de campanha (opcional)</span>
          <input maxLength={60} value={form.trackingLabel || ""} onChange={e => update("trackingLabel", e.target.value)} placeholder="Ex.: jardim-novembro" className="w-full rounded-lg border p-3"/>
        </label>
      </div>
      <p className="text-xs text-slate-500">A etiqueta ajuda a organizar os links. Para rastrear comissões no Mercado Livre, crie a etiqueta e o link rastreável no próprio painel do programa; não modificamos sua URL.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block space-y-1"><span className="text-sm font-medium">Preço de referência (opcional)</span>
          <input type="number" min="0" max="1000000" step="0.01" value={form.price} onChange={e => update("price", e.target.value)} placeholder="99,90" className="w-full rounded-lg border p-3"/>
        </label>
        <label className="block space-y-1"><span className="text-sm font-medium">Programar revisão (opcional)</span>
          <input type="datetime-local" value={form.plannedAt} onChange={e => update("plannedAt", e.target.value)} className="w-full rounded-lg border p-3"/>
        </label>
      </div>
      <p className="text-xs text-slate-500">Preço e horário são internos; só o texto e o link entram na mensagem. Confirme preço e disponibilidade antes de divulgar.</p>
      <button type="submit" className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 font-semibold sm:w-auto">{editing ? "Salvar alterações" : "Adicionar à biblioteca"}</button>
    </form>
    <div className="rounded-2xl bg-white border p-4 space-y-3 sm:p-5">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-semibold text-lg">Ofertas salvas</h3>
        <div className="inline-flex w-full overflow-hidden rounded-lg border text-sm sm:w-auto">
          <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")} className={filter === "all" ? "flex-1 bg-indigo-600 text-white px-3 py-2 sm:flex-none" : "flex-1 px-3 py-2 sm:flex-none"}>Todas</button>
          <button type="button" aria-pressed={filter === "due"} onClick={() => setFilter("due")} className={filter === "due" ? "flex-1 bg-indigo-600 text-white px-3 py-2 sm:flex-none" : "flex-1 px-3 py-2 sm:flex-none"}>Pendentes</button>
          <button type="button" aria-pressed={filter === "upcoming"} onClick={() => setFilter("upcoming")} className={filter === "upcoming" ? "flex-1 bg-indigo-600 text-white px-3 py-2 sm:flex-none" : "flex-1 px-3 py-2 sm:flex-none"}>Futuras</button>
        </div>
      </div>
      <label className="flex items-center gap-2 rounded-lg border px-3"><Search size={18} className="text-slate-400"/><input aria-label="Buscar ofertas" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar produto..." className="w-full py-3 outline-none"/></label>
      {visible.length === 0 && <p className="text-sm text-slate-500 py-5">Nenhuma oferta encontrada. Cadastre a primeira acima.</p>}
      <div className="space-y-3">
        {visible.map(offer => <article key={offer.id} className="rounded-xl border p-3 space-y-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="font-semibold break-words">{offer.title}</h4>
              {offer.priceCents !== null && <p className="text-sm font-semibold text-emerald-700">{currency.format(offer.priceCents / 100)}</p>}
              {offer.trackingLabel && <p className="mt-1 text-xs text-indigo-700">Etiqueta: {offer.trackingLabel}</p>}
              {offer.plannedAt && <p className={"text-xs mt-1 " + (scheduledState(offer) === "due" ? "text-amber-700" : "text-slate-500")}>Revisar {new Date(offer.plannedAt).toLocaleString("pt-BR")}{scheduledState(offer) === "due" ? " · pendente" : ""}</p>}
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1">
              <button type="button" title="Editar oferta" aria-label={"Editar " + offer.title} onClick={() => edit(offer)} className="min-h-11 min-w-11 rounded-lg p-2 hover:bg-slate-100"><Edit3 size={16}/></button>
              <button type="button" title="Duplicar oferta" aria-label={"Duplicar " + offer.title} onClick={() => duplicate(offer)} className="p-2 rounded-lg hover:bg-slate-100"><Copy size={16}/></button>
              <button type="button" title="Excluir oferta" aria-label={"Excluir " + offer.title} onClick={() => remove(offer)} className="min-h-11 min-w-11 rounded-lg p-2 text-red-700 hover:bg-red-50"><Trash2 size={16}/></button>
            </div>
          </div>
          <p className="text-sm text-slate-600 whitespace-pre-wrap line-clamp-3">{offer.message}</p>
          {offer.link && <p className="text-xs text-indigo-700 truncate">{offer.link}</p>}
          <button type="button" onClick={() => onUse(offer)} className="inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 sm:w-auto">
            Usar no envio manual <ArrowRight size={16}/>
          </button>
        </article>)}
      </div>
    </div>
  </section>;
}
