import React, { useEffect, useState, type ComponentType } from "react";
import {
  ArrowRight, CalendarClock, CheckCircle2, ChevronRight, CircleHelp, Clock3,
  ExternalLink, LayoutDashboard, Loader2, LogOut, Package, Plus,
  Send, Settings2, ShieldCheck, Smartphone, Sparkles, WifiOff
} from "lucide-react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, loginWithGoogle, logout } from "./firebase";
import { describeGoogleLoginError } from "./auth/loginErrors";
import OfferLibrary from "./components/OfferLibrary";
import SchedulePlanner from "./components/SchedulePlanner";
import WhatsAppConnection from "./components/WhatsAppConnection";
import { getOfferSummary, type OfferSummary } from "./dashboard/summary";

type Group = { id: string; nome: string };
type Feedback = { ok: boolean; message: string };
type View = "dashboard" | "offers" | "schedule" | "publish" | "settings";

type NavItem = {
  id: View;
  title: string;
  icon: ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  description: string;
};
const nav: NavItem[] = [
  { id: "dashboard", title: "Visão geral", icon: LayoutDashboard, description: "Resumo da operação" },
  { id: "offers", title: "Ofertas", icon: Package, description: "Biblioteca e rascunhos" },
  { id: "schedule", title: "Agenda", icon: CalendarClock, description: "Rotinas semanais e canais" },
  { id: "publish", title: "Publicar", icon: Send, description: "Envio manual" },
  { id: "settings", title: "Conexão", icon: Settings2, description: "WhatsApp e conta" },
];

async function api<T>(route: string, method = "GET", data?: unknown): Promise<T> {
  const current = auth.currentUser;
  if (!current) throw new Error("Faça login novamente.");
  const idToken = await current.getIdToken();
  const response = await fetch(route, {
    method,
    headers: { Authorization: "Bearer " + idToken, "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Falha na requisição.");
  return result as T;
}

function StatusPill({ connected, qr }: { connected: boolean; qr: string }) {
  return <span className={connected
    ? "inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"
    : "inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800"}>
    <span className={"h-2 w-2 rounded-full " + (connected ? "bg-emerald-500" : "bg-amber-500")} />
    {connected ? "WhatsApp conectado" : qr ? "Aguardando leitura" : "WhatsApp desconectado"}
  </span>;
}

function StatTile({ label, count, description, icon: Icon }: {
  label: string; count: number; description: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}) {
  return <div className="surface-card p-4 md:p-6">
    <div className="mb-3 flex items-start justify-between gap-2 md:mb-5">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon size={20}/></div>
    </div>
    <p className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">{count}</p>
    <p className="mt-1 text-xs text-slate-500">{description}</p>
  </div>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [access, setAccess] = useState<"loading" | "authorized" | "denied">("loading");
  const [accessError, setAccessError] = useState("");
  const [view, setView] = useState<View>("dashboard");
  const [summary, setSummary] = useState<OfferSummary>({ total: 0, due: 0, upcoming: 0 });
  const [connected, setConnected] = useState(false);
  const [qr, setQr] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState("");
  const [statusError, setStatusError] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [groupPermissionConfirmed, setGroupPermissionConfirmed] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginErrorCode, setLoginErrorCode] = useState("");

  useEffect(() => onAuthStateChanged(auth, current => {
    setUser(current);
    setAuthLoading(false);
    setAccess("loading");
    setAccessError("");
    setView("dashboard");
    setConnected(false);
    setQr("");
    setGroups([]);
    setGroupId("");
    setStatusError("");
    setMessage("");
    setLink("");
    setFeedback(null);
    setGroupPermissionConfirmed(false);
    setLoginError("");
    setLoginErrorCode("");
    setSummary({ total: 0, due: 0, upcoming: 0 });
  }), []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void api<{ email: string }>("/api/me")
      .then(() => { if (!cancelled) setAccess("authorized"); })
      .catch(error => {
        if (!cancelled) {
          setAccess("denied");
          setAccessError(error instanceof Error ? error.message : "Acesso negado.");
        }
      });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user || access !== "authorized") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const status = await api<{ connected: boolean }>("/api/status");
        if (cancelled) return;
        setConnected(status.connected);
        setStatusError("");
        if (status.connected) setQr("");
        else {
          try {
            const data = await api<{ qr: string }>("/api/qr");
            if (!cancelled) setQr(data.qr);
          } catch { if (!cancelled) setQr(""); }
        }
      } catch (error) {
        if (!cancelled) {
          setStatusError(error instanceof Error ? error.message : "Conexão indisponível.");
          setConnected(false);
          setGroupPermissionConfirmed(false);
        }
      }
    };
    void poll();
    const interval = setInterval(() => { void poll(); }, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user, access]);

  useEffect(() => {
    if (!connected || access !== "authorized") {
      setGroups([]);
      setGroupId("");
      return;
    }
    let cancelled = false;
    void api<Group[]>("/api/grupos")
      .then(list => {
        if (cancelled) return;
        setGroups(list);
        setGroupId(old => list.some(group => group.id === old) ? old : list[0]?.id || "");
      })
      .catch(error => { if (!cancelled) setStatusError(error instanceof Error ? error.message : "Falha ao carregar grupos."); });
    return () => { cancelled = true; };
  }, [connected, access]);

  useEffect(() => {
    if (!user || access !== "authorized" || view !== "dashboard") return;
    try { setSummary(getOfferSummary(localStorage.getItem("affiliate-operator:offers:v1:" + user.uid))); }
    catch { setSummary({ total: 0, due: 0, upcoming: 0 }); }
  }, [user, access, view]);

  const navigate = (next: View) => {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const requestPairingCode = async (phoneNumber: string): Promise<string> => {
    const result = await api<{ code: string }>("/api/pairing-code", "POST", { phoneNumber });
    return result.code;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!groupId || !connected || !message.trim() || !groupPermissionConfirmed || sending) return;
    setSending(true);
    setFeedback(null);
    try {
      const response = await api<{ accepted: boolean; message: string }>("/api/share", "POST", {
        grupoId: groupId, mensagem: message, link,
      });
      setFeedback({ ok: true, message: response.message });
      setMessage("");
      setLink("");
      setGroupPermissionConfirmed(false);
    } catch (error) {
      setFeedback({ ok: false, message: error instanceof Error ? error.message : "Erro ao enviar." });
    } finally {
      setSending(false);
    }
  };

  const handleLogin = async () => {
    setLoginError("");
    setLoginErrorCode("");
    try { await loginWithGoogle(); }
    catch (error) {
      const failure = describeGoogleLoginError(error);
      setLoginError(failure.message);
      setLoginErrorCode(failure.code);
    }
  };

  if (authLoading) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={34}/></div>;

  if (!user) return <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-5">
    <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
      <div className="h-2 bg-gradient-to-r from-indigo-600 via-violet-500 to-sky-400"/>
      <div className="space-y-6 p-8 text-center md:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200"><Send size={30}/></div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">DevTecs · Ferramenta privada</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Affiliate Operator</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Organize ofertas, prepare publicações e compartilhe nos grupos autorizados.</p>
        </div>
        <button type="button" onClick={() => void handleLogin()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 p-3.5 font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
          Entrar com Google <ArrowRight size={18}/>
        </button>
        {loginError && <div role="alert" className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-left">
          <p className="text-sm text-red-800">{loginError}</p>
          <p className="break-all font-mono text-xs text-red-700">Código: {loginErrorCode}</p>
          {loginErrorCode === "auth/unauthorized-domain" && <p className="text-xs text-slate-700">
            Autorize <code>{window.location.hostname}</code> no Firebase Authentication. <a className="underline" href="https://console.firebase.google.com/project/affiliate-operator/authentication/settings" target="_blank" rel="noopener noreferrer">Abrir configurações</a>
          </p>}
        </div>}
        <p className="text-xs text-slate-400">Acesso restrito a operadores autorizados.</p>
      </div>
    </div>
  </main>;

  const current = nav.find(item => item.id === view) ?? nav[0];

  return <main className="min-h-screen overflow-x-clip bg-[#f5f7fb] text-slate-900">
    <div className="mx-auto flex min-h-screen max-w-[1550px] flex-col md:flex-row">
      <aside className="hidden border-b border-slate-800 bg-[#111827] px-4 py-4 text-white md:sticky md:top-0 md:flex md:h-screen md:w-[255px] md:shrink-0 md:flex-col md:border-b-0 md:px-4 md:py-7">
        <div className="flex items-center justify-between gap-3 px-1 md:px-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-white"><Send size={20}/></div>
            <div>
              <p className="text-base font-extrabold tracking-tight">Affiliate Operator</p>
              <p className="text-[11px] tracking-wide text-slate-400">Operação privada · DevTecs</p>
            </div>
          </div>
          <span className="hidden h-2 w-2 rounded-full bg-emerald-400 md:block"/>
        </div>
        <nav aria-label="Navegação principal" className="mt-5 flex gap-1 overflow-x-auto pb-1 md:mt-10 md:flex-col md:gap-2 md:overflow-visible">
          {nav.map(item => {
            const Icon = item.icon;
            return <button key={item.id} type="button" aria-current={view === item.id ? "page" : undefined}
              onClick={() => navigate(item.id)}
              className={"flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-indigo-300 md:w-full " +
                (view === item.id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/40" : "text-slate-300 hover:bg-slate-800 hover:text-white")}>
              <Icon size={18} strokeWidth={2}/><span>{item.title}</span>
            </button>;
          })}
        </nav>
        <div className="mt-auto hidden space-y-4 px-2 pt-5 md:block">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-white"><ShieldCheck size={15}/> Uso assistido</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">Sem disparos automáticos. Publicações exigem confirmação.</p>
          </div>
          <p className="truncate text-xs text-slate-400" title={user.email || ""}>{user.email}</p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 bg-[#111827] px-4 py-3 text-white md:hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500"><Send size={18}/></div>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold tracking-tight">Affiliate Operator</p>
            <p className="text-[11px] text-slate-400">DevTecs · Painel do operador</p>
          </div>
        </div>
        <header className="border-b border-slate-200 bg-white/90 px-4 py-4 md:px-8 md:py-6">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 sm:gap-4">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-indigo-600">Painel do operador</p>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl md:text-3xl">{current.title}</h1>
              <p className="mt-1 text-sm text-slate-500">{current.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusPill connected={connected} qr={qr}/>
              <button type="button" onClick={() => void logout()} title="Sair da conta" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-500">
                <LogOut size={17}/> <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto min-w-0 max-w-6xl space-y-5 px-3 pt-4 pb-[calc(7.75rem+env(safe-area-inset-bottom))] sm:px-5 md:space-y-6 md:px-8 md:py-8">
          {access === "loading" ? (
            <div className="surface-card flex items-center justify-center gap-3 p-10 text-sm text-slate-600"><Loader2 size={22} className="animate-spin text-indigo-600"/> Validando autorização...</div>
          ) : access === "denied" ? (
            <div role="alert" className="surface-card flex items-start gap-3 border-red-200 bg-red-50 p-6 text-red-800">
              <ShieldCheck size={23} className="shrink-0"/>
              <div><h2 className="font-semibold">Acesso não autorizado</h2><p className="mt-1 text-sm">{accessError}</p><p className="mt-2 text-xs">Confirme seu e-mail na variável AUTHORIZED_EMAILS do Render.</p></div>
            </div>
          ) : (
            <>
              {view === "dashboard" && <>
                <section className="rounded-2xl bg-gradient-to-br from-[#18254f] via-[#252b65] to-[#4338a2] px-5 py-6 text-white shadow-lg shadow-indigo-100 sm:rounded-3xl sm:px-8 sm:py-9">
                  <div className="max-w-2xl">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-indigo-100"><Sparkles size={15}/> Seu espaço de trabalho</div>
                    <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl md:text-3xl">Ofertas organizadas, divulgação no controle.</h2>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100">Cadastre produtos, planeje revisões e prepare mensagens. Você decide quando compartilhar em cada grupo autorizado.</p>
                    <div className="mt-6 flex flex-wrap gap-2">
                      <button onClick={() => navigate("offers")} type="button" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-indigo-800 hover:bg-indigo-50"><Plus size={17}/> Nova oferta</button>
                      <button onClick={() => navigate("schedule")} type="button" className="inline-flex items-center gap-2 rounded-xl border border-white/35 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10">Montar agenda semanal <CalendarClock size={17}/></button>
                      <button onClick={() => navigate("publish")} type="button" className="inline-flex items-center gap-2 rounded-xl border border-white/35 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10">Preparar publicação <ArrowRight size={17}/></button>
                    </div>
                  </div>
                </section>
                <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4" aria-label="Resumo local das ofertas">
                  <StatTile label="Ofertas salvas" count={summary.total} description="Neste navegador" icon={Package}/>
                  <StatTile label="Revisões pendentes" count={summary.due} description="Datas planejadas já atingidas" icon={Clock3}/>
                  <StatTile label="Próximas revisões" count={summary.upcoming} description="Datas planejadas futuras" icon={CalendarClock}/>
                </section>
                <div className="grid gap-5 lg:grid-cols-2">
                  <section className="surface-card space-y-4 p-6">
                    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Conexão WhatsApp</h2><StatusPill connected={connected} qr={qr}/></div>
                    <p className="text-sm leading-6 text-slate-600">
                      {connected ? "A sessão está ativa e os grupos podem ser usados para envio manual." : "Conecte o WhatsApp com QR Code para listar os grupos participantes da conta."}
                    </p>
                    <button type="button" onClick={() => navigate("settings")} className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:text-indigo-900">
                      {connected ? "Ver conexão" : "Conectar WhatsApp"} <ChevronRight size={17}/>
                    </button>
                    {statusError && <p className="text-xs text-red-700" role="alert">{statusError}</p>}
                  </section>
                  <section className="surface-card space-y-4 p-6">
                    <div className="flex items-center gap-3"><div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600"><CircleHelp size={20}/></div><h2 className="text-lg font-bold">Como começar</h2></div>
                    <p className="text-sm leading-6 text-slate-600">Cadastre uma oferta na biblioteca, vincule seu WhatsApp e use a aba Publicar para revisar e enviar manualmente a mensagem.</p>
                    <p className="text-xs leading-5 text-slate-500">Planejamento não é agendamento automático. Preços e links devem ser conferidos antes da divulgação.</p>
                  </section>
                </div>
              </>}

              {view === "offers" && <OfferLibrary uid={user.uid} onUse={draft => {
                setMessage(draft.message);
                setLink(draft.link);
                setFeedback(null);
                setGroupPermissionConfirmed(false);
                navigate("publish");
              }}/>}

              {view === "schedule" && <SchedulePlanner uid={user.uid} onOpenOffers={() => navigate("offers")} onPrepareWhatsapp={offer => {
                setMessage(offer.message);
                setLink(offer.link);
                setFeedback(null);
                setGroupPermissionConfirmed(false);
                navigate("publish");
              }}/>}
 
              {view === "publish" && <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="surface-card min-w-0 space-y-5 p-4 sm:p-7">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Revisar e confirmar</p>
                    <h2 className="mt-1 text-xl font-extrabold text-slate-950">Enviar oferta a um grupo</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">Somente envio manual para grupos em que a conta participa e tem autorização para divulgar.</p>
                  </div>
                  <form onSubmit={event => void submit(event)} className="space-y-4">
                    <label className="block space-y-1.5">
                      <span className="text-sm font-semibold text-slate-800">Grupo destinatário</span>
                      <select required value={groupId} onChange={event => { setGroupId(event.target.value); setGroupPermissionConfirmed(false); }}
                        disabled={!connected || groups.length === 0} className="field-control bg-white">
                        {groups.length === 0 ? <option value="">Nenhum grupo disponível</option> : groups.map(group => <option key={group.id} value={group.id}>{group.nome}</option>)}
                      </select>
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-sm font-semibold text-slate-800">Texto da oferta</span>
                      <textarea required maxLength={3000} rows={6} value={message} onChange={event => setMessage(event.target.value)} className="field-control" placeholder="Descreva o produto, o preço e as condições da oferta." />
                      <span className="block text-right text-xs text-slate-400">{message.length}/3000</span>
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-sm font-semibold text-slate-800">Link de afiliado (HTTPS)</span>
                      <input type="url" pattern="https://.*" maxLength={2048} value={link} onChange={event => setLink(event.target.value)} className="field-control" placeholder="https://..." />
                    </label>
                    {message.trim() && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Prévia da mensagem</p>
                      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{message}{link && <span className="block break-all pt-3 text-indigo-700">{link}</span>}</p>
                    </div>}
                    <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm leading-6 text-amber-900">
                      <input type="checkbox" checked={groupPermissionConfirmed} onChange={event => setGroupPermissionConfirmed(event.target.checked)} required className="mt-1.5 shrink-0"/>
                      Confirmo que tenho permissão para divulgar neste grupo e que o link cumpre as regras do programa de afiliados.
                    </label>
                    {feedback && <p role="status" className={"rounded-xl p-3 text-sm " + (feedback.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700")}>{feedback.message}</p>}
                    <button type="submit" disabled={!connected || !groupId || !message.trim() || !groupPermissionConfirmed || sending}
                      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
                      {sending ? <Loader2 size={18} className="animate-spin"/> : <Send size={18}/>}
                      {sending ? "Solicitando envio..." : "Confirmar envio manual"}
                    </button>
                  </form>
                </div>
                <aside className="space-y-4">
                  <div className="surface-card space-y-3 p-5">
                    <h3 className="font-bold">Antes de publicar</h3>
                    <p className="text-sm leading-6 text-slate-600">Confirme a validade da oferta, o link, as regras da plataforma e a autorização do grupo.</p>
                    <div className="border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">O uso do Baileys é não oficial. A solicitação de envio aceita pela API não comprova a entrega da mensagem.</div>
                  </div>
                  {!connected && <button type="button" onClick={() => navigate("settings")} className="flex w-full items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-left text-sm font-semibold text-indigo-700">
                    <span className="flex items-center gap-2"><Smartphone size={18}/> Conectar WhatsApp</span><ArrowRight size={18}/>
                  </button>}
                  {statusError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{statusError}</p>}
                </aside>
              </section>}

              {view === "settings" && <div className="space-y-5">
                <WhatsAppConnection connected={connected} qr={qr} statusError={statusError} requestPairingCode={requestPairingCode}/>
                <section className="surface-card space-y-4 p-6">
                  <h2 className="text-lg font-bold">Sua conta</h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700">{(user.email || "?").charAt(0).toUpperCase()}</div>
                    <div className="min-w-0"><p className="break-all text-sm font-semibold text-slate-900">{user.email}</p><p className="text-xs text-slate-500">Login Google · Firebase Authentication</p></div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                    As ofertas ficam neste navegador, separadas pela conta Google. Use a exportação de backup na aba Ofertas para transferir os dados entre dispositivos.
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <a href="https://console.firebase.google.com/project/affiliate-operator/authentication" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-indigo-700 hover:underline">Firebase Authentication <ExternalLink size={15}/></a>
                    <button type="button" onClick={() => void logout()} className="inline-flex items-center gap-1.5 font-semibold text-slate-600 hover:text-slate-900"><LogOut size={16}/> Sair da conta</button>
                  </div>
                </section>
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  <WifiOff size={20} className="mt-0.5 shrink-0"/>
                  <p><strong>Hospedagem gratuita:</strong> o Render pode suspender o servidor e perder os arquivos locais da sessão WhatsApp. Se isso acontecer, será necessário vincular novamente o aparelho.</p>
                </div>
              </div>}

              <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 py-5 text-xs text-slate-500">
                <span className="flex items-center gap-2"><ShieldCheck size={15}/> Affiliate Operator · Uso privado e assistido</span>
                <span>Sem disparos automáticos</span>
              </footer>
            </>
          )}
        </div>
      </div>
    </div>
    {access === "authorized" && <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-1 pt-2 shadow-[0_-6px_24px_rgba(15,23,42,0.09)] backdrop-blur-md md:hidden" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}>
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {nav.map(item => {
          const Icon = item.icon;
          return <button key={item.id} type="button" aria-label={item.title} aria-current={view === item.id ? "page" : undefined}
            onClick={() => navigate(item.id)}
            className={"mobile-nav-button flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition focus-visible:outline-2 focus-visible:outline-indigo-600 " +
              (view === item.id ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50")}>
            <Icon size={21} strokeWidth={view === item.id ? 2.5 : 2}/>
            <span className="max-w-full truncate text-[10px] font-semibold leading-tight">{item.title}</span>
          </button>;
        })}
      </div>
    </nav>}
  </main>;
}
