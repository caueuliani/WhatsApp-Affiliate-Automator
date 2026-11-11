import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Loader2, LogOut, Send, ShieldCheck, QrCode } from "lucide-react";
import { auth, loginWithGoogle, logout } from "./firebase";
import { onAuthStateChanged, type User } from "firebase/auth";

type Group = { id: string; nome: string };
type Feedback = { ok: boolean; message: string };
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [access, setAccess] = useState<"loading" | "authorized" | "denied">("loading");
  const [accessError, setAccessError] = useState("");
  const [connected, setConnected] = useState(false);
  const [qr, setQr] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState("");
  const [statusError, setStatusError] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => onAuthStateChanged(auth, current => {
    setUser(current);
    setAuthLoading(false);
    setAccess("loading");
    setAccessError("");
    setConnected(false);
    setQr("");
    setGroups([]);
    setGroupId("");
    setFeedback(null);
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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!groupId || !message.trim() || sending) return;
    setSending(true);
    setFeedback(null);
    try {
      const response = await api<{ accepted: boolean; message: string }>("/api/share", "POST", {
        grupoId: groupId, mensagem: message, link
      });
      setFeedback({ ok: true, message: response.message });
      setMessage("");
      setLink("");
    } catch (error) {
      setFeedback({ ok: false, message: error instanceof Error ? error.message : "Erro ao enviar." });
    } finally {
      setSending(false);
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  if (!user) return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-2xl border bg-white p-8 space-y-5 text-center shadow-sm">
        <Send className="mx-auto h-10 w-10 text-indigo-600" />
        <h1 className="text-2xl font-bold">Affiliate Operator</h1>
        <p className="text-slate-600">Ferramenta privada para organizar e compartilhar ofertas manualmente em grupos.</p>
        <button type="button" onClick={() => void loginWithGoogle()} className="w-full rounded-lg bg-indigo-600 p-3 text-white font-semibold hover:bg-indigo-700">Entrar com Google</button>
      </section>
    </main>
  );

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="bg-white rounded-2xl p-5 border shadow-sm flex gap-4 items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Affiliate Operator</h1>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
          <button type="button" onClick={() => void logout()} className="rounded-lg border px-3 py-2 text-sm flex items-center gap-2"><LogOut size={16} /> Sair</button>
        </header>
        {access === "loading" ? (
          <div className="rounded-xl border bg-white p-8 flex gap-3 justify-center"><Loader2 className="animate-spin" /> Verificando autorização...</div>
        ) : access === "denied" ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800"><AlertCircle className="inline mr-2" />{accessError}</div>
        ) : (
          <>
            <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2"><QrCode size={20}/> Conexão do WhatsApp</h2>
              {connected ? (
                <p className="text-emerald-700 flex gap-2 items-center"><CheckCircle2 size={20} /> Conectado</p>
              ) : qr ? (
                <div className="space-y-3">
                  <img src={qr} alt="QR Code para conectar o WhatsApp" className="w-52 h-52" />
                  <p className="text-sm text-slate-600">No celular: WhatsApp → Aparelhos conectados → Conectar aparelho.</p>
                </div>
              ) : (
                <p className="text-sm text-slate-600 flex gap-2 items-center"><Loader2 size={18} className="animate-spin"/> Preparando QR Code...</p>
              )}
              {statusError && <p role="alert" className="text-red-700 text-sm">{statusError}</p>}
            </section>
            <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-5">
              <div>
                <h2 className="text-lg font-semibold">Enviar oferta a um grupo</h2>
                <p className="text-sm text-slate-500">Envio manual, para grupos em que esta conta participa e tem permissão de publicar. Não há agendamento ou disparo em massa.</p>
              </div>
              <form onSubmit={event => void submit(event)} className="space-y-4">
                <label className="block space-y-1">
                  <span className="text-sm font-medium">Grupo</span>
                  <select required value={groupId} onChange={event => setGroupId(event.target.value)} disabled={!connected || groups.length === 0} className="w-full rounded-lg border p-3 bg-white">
                    {groups.length === 0 ? <option value="">Nenhum grupo disponível</option> : groups.map(group => <option key={group.id} value={group.id}>{group.nome}</option>)}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium">Texto da oferta</span>
                  <textarea required maxLength={3000} rows={5} value={message} onChange={event => setMessage(event.target.value)} className="w-full rounded-lg border p-3" placeholder="Descreva o produto e as condições da oferta" />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium">Link de afiliado (HTTPS, opcional)</span>
                  <input type="url" pattern="https://.*" maxLength={2048} value={link} onChange={event => setLink(event.target.value)} className="w-full rounded-lg border p-3" placeholder="https://..." />
                </label>
                <p className="text-xs text-amber-800 bg-amber-50 p-3 rounded-lg">Verifique as regras do programa de afiliados e do grupo antes do envio. A ferramenta não impede restrições ou bloqueios do WhatsApp.</p>
                {feedback && <p role="status" className={feedback.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{feedback.message}</p>}
                <button type="submit" disabled={!connected || !groupId || !message.trim() || sending} className="rounded-lg bg-indigo-600 px-5 py-3 text-white font-semibold disabled:opacity-50 flex gap-2 items-center justify-center">
                  {sending ? <Loader2 size={18} className="animate-spin"/> : <Send size={18}/>}
                  {sending ? "Solicitando envio..." : "Enviar agora"}
                </button>
              </form>
            </section>
            <footer className="text-xs text-slate-500 flex items-center gap-2"><ShieldCheck size={15} /> Uso privado e assistido. A confirmação da API não significa entrega ao destinatário.</footer>
          </>
        )}
      </div>
    </main>
  );
}
