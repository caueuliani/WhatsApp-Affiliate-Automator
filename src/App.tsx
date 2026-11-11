import React, { useState, useEffect } from "react";
import { QrCode, Send, CheckCircle2, AlertCircle, Loader2, Users, User, List, LogOut, ShieldAlert, Shield, CreditCard } from "lucide-react";
import { auth, db, loginWithGoogle, logout } from "./firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import AdminPanel from "./components/AdminPanel";

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [appUser, setAppUser] = useState<any>(null); // from Firestore

  const [isConnected, setIsConnected] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // Form state
  const [link, setLink] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Groups state
  const [grupos, setGrupos] = useState<{id: string, nome: string}[]>([]);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const [modoEntrada, setModoEntrada] = useState<"lista" | "manual">("lista");

  // Tabs state
  const [activeTab, setActiveTab] = useState<"grupos" | "maladireta">("grupos");

  // Bulk state
  const [bulkNumbersText, setBulkNumbersText] = useState("");
  const [bulkJobId, setBulkJobId] = useState<string | null>(null);
  const [bulkJobStatus, setBulkJobStatus] = useState<any>(null);

  // Auth Effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const idToken = await currentUser.getIdToken();
        setToken(idToken);
        
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const snap = await getDoc(userRef);
          const adminEmail = "caueuliani@gmail.com";
          const isAdmin = currentUser.email?.toLowerCase() === adminEmail;
          
          let userData: any = null;
          if (snap.exists()) {
            userData = snap.data();
          } else {
            userData = {
              email: currentUser.email,
              name: currentUser.displayName,
              status: isAdmin ? 'active' : 'inactive',
              createdAt: Date.now()
            };
            await setDoc(userRef, userData);
          }
          
          setAppUser({ ...userData, isAdmin });
        } catch (error) {
          console.error("Failed to load user data from Firestore", error);
        } finally {
          setAuthLoading(false);
        }
      } else {
        setToken(null);
        setAppUser(null);
        setIsConnected(false);
        setQrCode(null);
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const authHeaders = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  const hasAccess = appUser?.isAdmin || appUser?.status === "active" || (appUser?.status === "trial" && appUser?.trialEndsAt > Date.now());

  // Poll for connection status and QR code
  useEffect(() => {
    if (!token || !hasAccess) return;
    let statusInterval: ReturnType<typeof setInterval>;

    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/status", { headers: authHeaders });
        if (!res.ok) return;
        const data = await res.json();
        
        setIsConnected(data.connected);
        setLoadingStatus(false);

        if (!data.connected) {
          const qrRes = await fetch("/api/qr", { headers: authHeaders });
          if (qrRes.ok) {
            const qrData = await qrRes.json();
            setQrCode(qrData.qr);
          }
        } else {
          setQrCode(null);
        }
      } catch (error) {
        // Silently ignore network errors during polling to prevent console noise
      }
    };

    fetchStatus();
    statusInterval = setInterval(fetchStatus, 3000);
    return () => clearInterval(statusInterval);
  }, [token, hasAccess]);

  // Poll for bulk job status
  useEffect(() => {
    if (!token || !hasAccess) return;
    let bulkInterval: ReturnType<typeof setInterval>;
    if (bulkJobId && bulkJobStatus?.status !== "completed" && bulkJobStatus?.status !== "error") {
      bulkInterval = setInterval(async () => {
        try {
          const res = await fetch(`/api/bulk-status/${bulkJobId}`, { headers: authHeaders });
          if (res.ok) {
            const data = await res.json();
            setBulkJobStatus(data);
            if (data.status === "completed" || data.status === "error") {
              clearInterval(bulkInterval);
            }
          }
        } catch (error) {
          // Silently ignore network errors during polling
        }
      }, 2000);
    }
    return () => clearInterval(bulkInterval);
  }, [bulkJobId, bulkJobStatus?.status, token, hasAccess]);

  // Fetch groups when connected
  useEffect(() => {
    if (isConnected && token && hasAccess) {
      setLoadingGrupos(true);
      fetch("/api/grupos", { headers: authHeaders })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setGrupos(data);
            if (data.length > 0 && !grupoId) {
              setGrupoId(data[0].id);
            }
          }
        })
        .catch(err => console.error("Erro ao carregar grupos", err))
        .finally(() => setLoadingGrupos(false));
    } else {
      setGrupos([]);
    }
  }, [isConnected, token, hasAccess]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grupoId || !mensagem || !token) return;

    setIsSending(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ link, grupoId, mensagem }),
      });

      const data = await res.json();

      if (res.ok) {
        setFeedback({ type: "success", text: "Mensagem enviada com sucesso!" });
        setLink("");
        setMensagem("");
      } else {
        setFeedback({ type: "error", text: data.error || "Erro ao enviar mensagem" });
      }
    } catch (error) {
      setFeedback({ type: "error", text: "Erro de conexão ao enviar" });
    } finally {
      setIsSending(false);
    }
  };

  const handleBulkSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkNumbersText || !mensagem || !token) return;

    const numbers = bulkNumbersText
      .split(/[\n,]+/)
      .map(n => n.trim())
      .filter(n => n.length > 0);

    if (numbers.length === 0) return;

    setIsSending(true);
    setFeedback(null);
    setBulkJobStatus(null);

    try {
      const res = await fetch("/api/bulk-share", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ numbers, link, mensagem }),
      });

      const data = await res.json();

      if (res.ok) {
        setBulkJobId(data.jobId);
        setFeedback({ type: "success", text: "Disparo em lote iniciado com sucesso!" });
      } else {
        setFeedback({ type: "error", text: data.error || "Erro ao iniciar disparo" });
      }
    } catch (error) {
      setFeedback({ type: "error", text: "Erro de conexão ao iniciar disparo" });
    } finally {
      setIsSending(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!user || !appUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center space-y-6">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Send className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">WhatsApp Automator SaaS</h1>
          <p className="text-slate-500">Faça login para gerenciar sua sessão isolada do WhatsApp e realizar envios em massa de forma segura.</p>
          <button 
            onClick={loginWithGoogle}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
          >
            Entrar com Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">WhatsApp Automator</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-slate-500 text-sm">Olá, {user.displayName}!</p>
              {appUser?.status === 'trial' && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                  Trial Ativo
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {appUser?.isAdmin && (
              <button 
                onClick={() => setShowAdminPanel(!showAdminPanel)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
              >
                <Shield className="w-4 h-4" />
                Admin
              </button>
            )}

            {hasAccess && (
              loadingStatus ? (
                <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-100 text-slate-500 rounded-full font-medium text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verificando...</span>
                </div>
              ) : isConnected ? (
                <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-700 rounded-full font-medium text-sm border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Conectado</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-50 text-amber-700 rounded-full font-medium text-sm border border-amber-200">
                  <AlertCircle className="w-4 h-4" />
                  <span>Aguardando QR</span>
                </div>
              )
            )}

            <button onClick={logout} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors" title="Sair">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {showAdminPanel && appUser?.isAdmin ? (
          <AdminPanel token={token!} onClose={() => setShowAdminPanel(false)} />
        ) : !hasAccess ? (
          <div className="bg-white p-10 rounded-2xl shadow-sm border border-red-100 text-center max-w-lg mx-auto mt-12 space-y-6">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <ShieldAlert className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Acesso Suspenso</h2>
              <p className="text-slate-600">
                Sua conta está inativa ou o seu período de testes expirou. Para continuar usando o WhatsApp Automator e realizar seus disparos, renove sua assinatura.
              </p>
            </div>
            <div className="pt-4 flex flex-col gap-3">
              <a 
                href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20gostaria%20de%20renovar%2Fassinar%20o%20WhatsApp%20Automator" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <CreditCard className="w-5 h-5" />
                Assinar Plano / Renovar
              </a>
              <button 
                onClick={logout}
                className="w-full text-slate-500 hover:text-slate-700 font-medium py-2 text-sm transition-colors"
              >
                Sair da conta
              </button>
            </div>
          </div>
        ) : (
          /* MAIN CONTENT */
          <main className="grid md:grid-cols-12 gap-8">
            
            {/* LEFT COLUMN: QR CODE OR STATUS INFO */}
            <div className="md:col-span-5 space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center">
                <h2 className="font-semibold text-slate-900 mb-6 flex items-center justify-center gap-2">
                  <QrCode className="w-5 h-5 text-slate-500" />
                  Conexão do Dispositivo
                </h2>
                
                {isConnected ? (
                  <div className="py-8 flex flex-col items-center justify-center space-y-4">
                    <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Seu WhatsApp está conectado!</p>
                      <p className="text-sm text-slate-500 mt-1">A sessão é exclusiva para sua conta.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {qrCode ? (
                      <div className="inline-block p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                        <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48 mx-auto" />
                      </div>
                    ) : (
                      <div className="w-48 h-48 mx-auto bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                      </div>
                    )}
                    <div className="text-sm text-slate-600">
                      <p className="font-medium">1. Abra o WhatsApp no celular</p>
                      <p>2. Toque em <strong>Aparelhos Conectados</strong></p>
                      <p>3. Aponte a câmera para esta tela</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: DISPARO DE OFERTAS */}
            <div className="md:col-span-7">
              <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition-opacity duration-300 ${!isConnected ? 'opacity-50 pointer-events-none' : ''}`}>
                
                {/* TABS */}
                <div className="flex border-b border-slate-200 mb-6">
                  <button
                    className={`flex-1 py-3 text-sm font-medium border-b-2 flex items-center justify-center gap-2 transition-colors ${activeTab === 'grupos' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                    onClick={() => { setActiveTab('grupos'); setFeedback(null); }}
                  >
                    <Users className="w-4 h-4" />
                    Envio para Grupos
                  </button>
                  <button
                    className={`flex-1 py-3 text-sm font-medium border-b-2 flex items-center justify-center gap-2 transition-colors ${activeTab === 'maladireta' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                    onClick={() => { setActiveTab('maladireta'); setFeedback(null); }}
                  >
                    <User className="w-4 h-4" />
                    Mala Direta (DMs)
                  </button>
                </div>

                {activeTab === 'grupos' ? (
                  <form onSubmit={handleSend} className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="grupoId" className="block text-sm font-medium text-slate-700">
                          ID do Grupo (ou Número) *
                        </label>
                        <button
                          type="button"
                          onClick={() => setModoEntrada(modoEntrada === "lista" ? "manual" : "lista")}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          {modoEntrada === "lista" ? "Digitar Manualmente" : "Selecionar da Lista"}
                        </button>
                      </div>
                      
                      {modoEntrada === "lista" ? (
                        <div className="relative">
                          <select
                            id="grupoId"
                            value={grupoId}
                            onChange={(e) => setGrupoId(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all appearance-none bg-white"
                            required
                            disabled={loadingGrupos || grupos.length === 0}
                          >
                            <option value="" disabled>
                              {loadingGrupos ? "Carregando grupos..." : (grupos.length === 0 ? "Nenhum grupo encontrado" : "Selecione um grupo")}
                            </option>
                            {grupos.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.nome || g.id}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                          </div>
                        </div>
                      ) : (
                        <>
                          <input
                            id="grupoId"
                            type="text"
                            value={grupoId}
                            onChange={(e) => setGrupoId(e.target.value)}
                            placeholder="Ex: 1234567890@g.us ou 5511999999999"
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            required
                          />
                          <p className="text-xs text-slate-500 mt-1">Para grupos, o ID costuma terminar em @g.us</p>
                        </>
                      )}
                    </div>

                    <div>
                      <label htmlFor="link" className="block text-sm font-medium text-slate-700 mb-1">
                        Link do Produto/Afiliado
                      </label>
                      <input
                        id="link"
                        type="url"
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label htmlFor="mensagem" className="block text-sm font-medium text-slate-700 mb-1">
                        Texto da Oferta *
                      </label>
                      <textarea
                        id="mensagem"
                        value={mensagem}
                        onChange={(e) => setMensagem(e.target.value)}
                        placeholder="Digite a mensagem promocional aqui..."
                        rows={4}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
                        required
                      />
                    </div>

                    {feedback && (
                      <div className={`p-4 rounded-lg text-sm font-medium flex items-center gap-2 ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {feedback.text}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!isConnected || isSending}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Enviar para o Grupo
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleBulkSend} className="space-y-5">
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-sm">
                      <p className="font-medium flex items-center gap-2 mb-1">
                        <AlertCircle className="w-4 h-4" />
                        Aviso de Segurança (Anti-Spam)
                      </p>
                      <p>O envio em lote adiciona pausas aleatórias (5 a 15 segundos) entre cada mensagem para evitar bloqueios do WhatsApp.</p>
                    </div>

                    <div>
                      <label htmlFor="bulkNumbers" className="block text-sm font-medium text-slate-700 mb-1">
                        Lista de Contatos (Com DDI, ex: 5511999999999) *
                      </label>
                      <textarea
                        id="bulkNumbers"
                        value={bulkNumbersText}
                        onChange={(e) => setBulkNumbersText(e.target.value)}
                        placeholder="Cole os números aqui (um por linha ou separados por vírgula)..."
                        rows={5}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
                        required
                        disabled={bulkJobStatus?.status === 'running'}
                      />
                      <p className="text-xs text-slate-500 mt-1">Insira apenas números (o sistema removerá traços e parênteses automaticamente).</p>
                    </div>

                    <div>
                      <label htmlFor="linkBulk" className="block text-sm font-medium text-slate-700 mb-1">
                        Link do Produto/Afiliado
                      </label>
                      <input
                        id="linkBulk"
                        type="url"
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        disabled={bulkJobStatus?.status === 'running'}
                      />
                    </div>

                    <div>
                      <label htmlFor="mensagemBulk" className="block text-sm font-medium text-slate-700 mb-1">
                        Texto da Oferta *
                      </label>
                      <textarea
                        id="mensagemBulk"
                        value={mensagem}
                        onChange={(e) => setMensagem(e.target.value)}
                        placeholder="Digite a mensagem promocional aqui..."
                        rows={4}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
                        required
                        disabled={bulkJobStatus?.status === 'running'}
                      />
                    </div>

                    {bulkJobStatus && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-slate-700">Progresso do Envio</span>
                          <span className="text-xs font-semibold px-2 py-1 bg-white rounded border border-slate-200 text-slate-600">
                            {bulkJobStatus.current} / {bulkJobStatus.total}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 mb-4">
                          <div 
                            className="bg-indigo-600 h-2 rounded-full transition-all duration-500" 
                            style={{ width: `${(bulkJobStatus.current / bulkJobStatus.total) * 100}%` }}
                          ></div>
                        </div>
                        
                        <div className="h-32 overflow-y-auto text-xs text-slate-600 font-mono bg-white p-2 border border-slate-100 rounded">
                          {bulkJobStatus.logs.map((log: string, idx: number) => (
                            <div key={idx} className="py-1 border-b border-slate-50 last:border-0">{log}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {feedback && !bulkJobStatus && (
                      <div className={`p-4 rounded-lg text-sm font-medium flex items-center gap-2 ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {feedback.text}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!isConnected || isSending || bulkJobStatus?.status === 'running'}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSending || bulkJobStatus?.status === 'running' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Disparando Lote...
                        </>
                      ) : (
                        <>
                          <List className="w-4 h-4" />
                          Iniciar Envio em Lote
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
            
          </main>
        )}
      </div>
    </div>
  );
}
