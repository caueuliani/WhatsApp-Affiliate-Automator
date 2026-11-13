import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ClipboardCopy, Download, Edit3, FileUp, Pause, Play, Plus, Send, Trash2, X } from "lucide-react";
import { exportLibrary, parseLibrary, storageKey, type OfferDraft } from "../offers/library";
import {
  createWeeklyRule, exportWeeklyRules, MAX_RULES, parseWeeklyRules, scheduleKey, upcomingOccurrences,
  WEEKDAYS, type WeeklyInput, type WeeklyRule,
} from "../schedule/weekly";

type Props = {
  uid: string;
  onPrepareWhatsapp: (offer: OfferDraft) => void;
  onOpenOffers: () => void;
};
const initial: WeeklyInput = { offerId: "", weekdays: [], time: "09:00", channel: "whatsapp", destinationLabel: "" };
const channelName = (channel: WeeklyRule["channel"]) => channel === "whatsapp" ? "WhatsApp" : "Instagram";
const formatDate = (date: string) => new Date(date + "T12:00:00Z").toLocaleDateString("pt-BR", {
  timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit",
});

export default function SchedulePlanner({ uid, onPrepareWhatsapp, onOpenOffers }: Props) {
  const key = scheduleKey(uid);
  const [offers] = useState<OfferDraft[]>(() => {
    try { return parseLibrary(localStorage.getItem(storageKey(uid)) || exportLibrary([])); }
    catch { return []; }
  });
  const [rules, setRules] = useState<WeeklyRule[]>(() => {
    try { return parseWeeklyRules(localStorage.getItem(key) || exportWeeklyRules([])); }
    catch { return []; }
  });
  const [input, setInput] = useState<WeeklyInput>(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(key, exportWeeklyRules(rules)); }
    catch { setError("Não foi possível salvar a agenda neste navegador. Exporte um backup."); }
  }, [key, rules]);

  const offerMap = useMemo(() => new Map(offers.map(offer => [offer.id, offer])), [offers]);
  const occurrences = useMemo(() => upcomingOccurrences(rules, offers, now, 14), [rules, offers, now]);
  const pendingToday = occurrences.filter(item => item.due);
  const enabledRules = rules.filter(rule => rule.enabled).length;

  const change = <K extends keyof WeeklyInput>(field: K, value: WeeklyInput[K]) =>
    setInput(previous => ({ ...previous, [field]: value }));
  const toggleDay = (day: 0 | 1 | 2 | 3 | 4 | 5 | 6) => {
    setInput(previous => ({ ...previous, weekdays: previous.weekdays.includes(day)
      ? previous.weekdays.filter(x => x !== day)
      : [...previous.weekdays, day] }));
  };
  const save = (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setNotice("");
    try {
      const old = editing ? rules.find(rule => rule.id === editing) : undefined;
      if (!old && rules.length >= MAX_RULES) throw new Error("Limite de 100 rotinas semanais atingido.");
      const rule = createWeeklyRule(input, offers.map(offer => offer.id), old?.id || crypto.randomUUID());
      if (old) {
        rule.createdAt = old.createdAt;
        rule.enabled = old.enabled;
        setRules(previous => previous.map(item => item.id === rule.id ? rule : item));
      } else setRules(previous => [...previous, rule]);
      setInput(initial); setEditing(null);
      setNotice(old ? "Rotina atualizada." : "Rotina salva. Ela é um planejamento, não um envio automático.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar."); }
  };
  const edit = (rule: WeeklyRule) => {
    setEditing(rule.id);
    setInput({
      offerId: rule.offerId, weekdays: [...rule.weekdays], time: rule.time,
      channel: rule.channel, destinationLabel: rule.destinationLabel,
    });
    document.getElementById("weekly-rule-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const remove = (rule: WeeklyRule) => {
    if (!window.confirm("Excluir esta rotina semanal?")) return;
    setRules(previous => previous.filter(item => item.id !== rule.id));
    if (editing === rule.id) { setEditing(null); setInput(initial); }
    setNotice("Rotina excluída.");
  };
  const exportBackup = () => {
    const blob = new Blob([exportWeeklyRules(rules)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "affiliate-operator-agenda.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importBackup = async (file: File | undefined) => {
    if (!file) return;
    setError(""); setNotice("");
    if (file.size > 250_000) { setError("Arquivo ultrapassa 250 KB."); return; }
    try {
      const incoming = parseWeeklyRules(await file.text());
      const invalidReferences = incoming.filter(rule => !offerMap.has(rule.offerId));
      if (invalidReferences.length) {
        throw new Error("Este backup referencia ofertas que não existem neste navegador. Importe as ofertas primeiro.");
      }
      if (!window.confirm("Substituir as rotinas atuais por " + incoming.length + " rotinas do arquivo?")) return;
      setRules(incoming); setEditing(null); setInput(initial);
      setNotice("Rotinas importadas. Confira os horários e destinos.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível importar."); }
  };
  const copyInstagram = async (offer: OfferDraft) => {
    const caption = offer.message + (offer.link ? "\n\nLink do produto: " + offer.link : "");
    try {
      await navigator.clipboard.writeText(caption);
      setError("");
      setNotice("Legenda copiada. A publicação no Instagram ainda é manual; links em legendas não são clicáveis.");
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione o texto na aba Ofertas.");
    }
  };

  return <section className="space-y-5">
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm leading-6 text-indigo-900">
      <strong>Agenda semanal recorrente:</strong> defina os produtos, dias, horários e canais. A agenda calcula as próximas duas semanas no fuso de São Paulo, mas <strong>não dispara mensagens nem publica posts sozinha</strong>. Seus dados ficam no navegador atual.
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      <div className="surface-card p-4"><p className="text-xs font-semibold text-slate-500">Rotinas ativas</p><p className="mt-2 text-2xl font-bold">{enabledRules}</p></div>
      <div className="surface-card p-4"><p className="text-xs font-semibold text-slate-500">Ocorrências nas próximas 2 semanas</p><p className="mt-2 text-2xl font-bold">{occurrences.length}</p></div>
      <div className="surface-card p-4"><p className="text-xs font-semibold text-slate-500">Horários atingidos hoje</p><p className="mt-2 text-2xl font-bold">{pendingToday.length}</p></div>
    </div>

    <div className="flex flex-wrap justify-end gap-2">
      <button type="button" onClick={exportBackup} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"><Download size={16}/> Exportar agenda</button>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">
        <FileUp size={16}/> Importar agenda
        <input type="file" className="sr-only" accept=".json,application/json" aria-label="Importar agenda JSON" onChange={e => { void importBackup(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }}/>
      </label>
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

    <form id="weekly-rule-editor" onSubmit={save} className="surface-card space-y-5 p-5 md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-xl font-bold text-slate-950">{editing ? "Editar rotina" : "Nova rotina semanal"}</h2><p className="mt-1 text-sm text-slate-500">Vincule uma oferta e escolha quando revisá-la para publicação.</p></div>
        {editing && <button type="button" className="inline-flex items-center gap-1 text-sm text-slate-600" onClick={() => { setInput(initial); setEditing(null); }}><X size={16}/> Cancelar</button>}
      </div>

      {offers.length === 0 && <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        Você ainda não cadastrou ofertas neste navegador. <button type="button" onClick={onOpenOffers} className="font-semibold underline">Cadastrar uma oferta</button> antes de montar a agenda.
      </div>}

      <label className="block space-y-2">
        <span className="text-sm font-semibold">Oferta cadastrada</span>
        <select required value={input.offerId} onChange={e => change("offerId", e.target.value)} className="field-control" disabled={offers.length === 0}>
          <option value="">Selecione o produto e link</option>
          {offers.map(offer => <option key={offer.id} value={offer.id}>{offer.title}{offer.trackingLabel ? " · " + offer.trackingLabel : ""}</option>)}
        </select>
      </label>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Repetir toda semana nos dias:</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map(day => <button key={day.id} type="button" aria-pressed={input.weekdays.includes(day.id)}
            title={day.label} onClick={() => toggleDay(day.id)}
            className={"rounded-xl border px-4 py-2 text-sm font-semibold transition " + (input.weekdays.includes(day.id)
              ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-indigo-50")}>{day.short}</button>)}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-semibold">Horário (São Paulo)</span>
          <input type="time" required value={input.time} onChange={e => change("time", e.target.value)} className="field-control"/>
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-semibold">Canal de divulgação</span>
          <select value={input.channel} onChange={e => change("channel", e.target.value as WeeklyInput["channel"])} className="field-control">
            <option value="whatsapp">WhatsApp · Preparar envio</option>
            <option value="instagram">Instagram · Preparar legenda</option>
          </select>
        </label>
      </div>
      <label className="block space-y-2">
        <span className="text-sm font-semibold">{input.channel === "whatsapp" ? "Nome do grupo autorizado (opcional)" : "Perfil Instagram (opcional)"}</span>
        <input maxLength={80} value={input.destinationLabel} onChange={e => change("destinationLabel", e.target.value)} className="field-control" placeholder={input.channel === "whatsapp" ? "Ex.: Grupo de ofertas público" : "Ex.: @perfilprofissional"}/>
      </label>

      {input.channel === "instagram" && <p className="rounded-xl bg-sky-50 p-3 text-xs leading-5 text-sky-900">
        Esta opção organiza legendas para revisão. A publicação automática exigirá conta Instagram profissional, mídia pública e integração autorizada com a API oficial da Meta.
      </p>}

      <button disabled={offers.length === 0 || input.weekdays.length === 0} type="submit"
        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
        <Plus size={17}/>{editing ? "Salvar alterações" : "Salvar rotina"}
      </button>
    </form>

    <section className="surface-card space-y-4 p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold">Rotinas configuradas</h2><p className="text-xs text-slate-500">{rules.length} de {MAX_RULES} rotinas · fuso America/Sao_Paulo</p></div>
      </div>
      {rules.length === 0 && <p className="rounded-xl bg-slate-50 px-4 py-6 text-sm text-slate-500">Nenhuma rotina cadastrada. Escolha uma oferta e marque os dias acima.</p>}
      <div className="space-y-3">
        {rules.map(rule => {
          const offer = offerMap.get(rule.offerId);
          return <article key={rule.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-950">{offer?.title || "Oferta excluída"}</p>
                <span className={"rounded-full px-2 py-1 text-xs font-semibold " + (rule.enabled ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500")}>{rule.enabled ? "Ativa" : "Pausada"}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{rule.weekdays.map(id => WEEKDAYS.find(day => day.id === id)?.short).join(", ")} · {rule.time} · {channelName(rule.channel)}</p>
              {rule.destinationLabel && <p className="mt-1 text-xs text-slate-500">Destino planejado: {rule.destinationLabel}</p>}
            </div>
            <div className="flex gap-1">
              <button title={rule.enabled ? "Pausar rotina" : "Ativar rotina"} aria-label={rule.enabled ? "Pausar rotina" : "Ativar rotina"} onClick={() => setRules(prev => prev.map(x => x.id === rule.id ? { ...x, enabled: !x.enabled, updatedAt: new Date().toISOString() } : x))}
                type="button" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">{rule.enabled ? <Pause size={17}/> : <Play size={17}/>}</button>
              <button title="Editar rotina" aria-label="Editar rotina" onClick={() => edit(rule)} type="button" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><Edit3 size={17}/></button>
              <button title="Excluir rotina" aria-label="Excluir rotina" onClick={() => remove(rule)} type="button" className="rounded-lg p-2 text-red-700 hover:bg-red-50"><Trash2 size={17}/></button>
            </div>
          </article>;
        })}
      </div>
    </section>

    <section className="surface-card space-y-4 p-5 md:p-6">
      <div><h2 className="flex items-center gap-2 text-lg font-bold"><CalendarDays size={20} className="text-indigo-600"/> Próximas publicações planejadas</h2><p className="mt-1 text-sm text-slate-500">Projeção dos próximos 14 dias. Horários vencidos não são enviados retroativamente.</p></div>
      {occurrences.length === 0 && <p className="rounded-xl bg-slate-50 px-4 py-6 text-sm text-slate-500">Nenhuma ocorrência prevista para as próximas duas semanas.</p>}
      <div className="space-y-2">
        {occurrences.map(entry => {
          const offer = offerMap.get(entry.offerId);
          if (!offer) return null;
          return <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 sm:p-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="min-w-[74px] rounded-lg bg-indigo-50 px-2 py-2 text-center text-xs font-semibold text-indigo-700">
                {formatDate(entry.date)}<span className="mt-1 block text-sm">{entry.time}</span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{entry.offerTitle}</p>
                <p className="text-xs text-slate-500">{channelName(entry.channel)}{entry.destinationLabel ? " · " + entry.destinationLabel : ""}</p>
                {entry.due && <p className="mt-1 text-xs font-semibold text-amber-700">Horário atingido · precisa de revisão manual</p>}
              </div>
            </div>
            {entry.channel === "whatsapp" ?
              <button onClick={() => onPrepareWhatsapp(offer)} type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"><Send size={15}/> Preparar envio</button>
            : <button onClick={() => void copyInstagram(offer)} type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"><ClipboardCopy size={15}/> Copiar legenda</button>}
          </div>;
        })}
      </div>
    </section>
    <div className="flex items-start gap-2 rounded-xl bg-slate-100 p-4 text-xs leading-5 text-slate-600">
      <Check size={17} className="shrink-0 text-indigo-700"/>
      A agenda é um planejamento local, não um serviço de disparos. No Render Free, suspensões e reinícios impedem garantir horários de execução. O WhatsApp ainda usa uma integração não oficial e exige validação das regras da plataforma.
    </div>
  </section>;
}
