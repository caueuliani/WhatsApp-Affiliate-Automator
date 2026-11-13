import React, { useEffect, useState } from "react";
import { Check, CheckCircle2, ClipboardCopy, Loader2, QrCode, Smartphone } from "lucide-react";

type Props = {
  connected: boolean;
  qr: string;
  statusError: string;
  requestPairingCode: (phoneNumber: string) => Promise<string>;
};

export default function WhatsAppConnection({ connected, qr, statusError, requestPairingCode }: Props) {
  const [method, setMethod] = useState<"phone" | "qr">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (connected) {
      setPairingCode("");
      setPhoneNumber("");
      setError("");
    }
  }, [connected]);

  const generateCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (requesting) return;
    setError("");
    setCopied(false);
    setPairingCode("");
    const digits = phoneNumber.trim();
    if (!/^[1-9][0-9]{9,14}$/.test(digits)) {
      setError("Informe o número completo com código do país e DDD, somente dígitos (ex.: 5511999999999).");
      return;
    }
    setRequesting(true);
    try {
      setPairingCode(await requestPairingCode(digits));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar o código.");
    } finally {
      setRequesting(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(pairingCode);
      setCopied(true);
    } catch {
      setError("Não foi possível copiar. Anote o código exibido e digite-o no WhatsApp.");
    }
  };

  return <section className="surface-card overflow-hidden" aria-labelledby="wa-heading">
    <div className="border-b border-slate-100 p-4 sm:p-6">
      <h2 id="wa-heading" className="text-lg font-bold text-slate-950">Conectar WhatsApp</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        Use o código para conectar pelo mesmo celular ou o QR Code para vincular usando outro aparelho.
      </p>
    </div>
    <div className="space-y-5 p-4 sm:p-6">
      {connected ? <div role="status" className="flex gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-800">
        <CheckCircle2 size={24} className="shrink-0"/>
        <div>
          <p className="font-semibold">Conta conectada</p>
          <p className="mt-1 text-sm leading-6">O WhatsApp está conectado à sessão atual do servidor. Confira os grupos na aba Publicar.</p>
        </div>
      </div> : <>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1" role="group" aria-label="Método de conexão">
          <button type="button" aria-pressed={method === "phone"} onClick={() => { setMethod("phone"); setError(""); }}
            className={"flex min-h-12 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition " + (method === "phone" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600")}>
            <Smartphone size={18}/> Mesmo celular
          </button>
          <button type="button" aria-pressed={method === "qr"} onClick={() => { setMethod("qr"); setError(""); }}
            className={"flex min-h-12 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition " + (method === "qr" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600")}>
            <QrCode size={18}/> Outro aparelho
          </button>
        </div>

        {method === "phone" ? <div className="space-y-5">
          <form onSubmit={event => void generateCode(event)} className="space-y-3">
            <label htmlFor="pairing-number" className="block text-sm font-semibold text-slate-900">Número do WhatsApp com DDI e DDD</label>
            <input id="pairing-number" type="tel" inputMode="numeric" autoComplete="tel-national"
              value={phoneNumber} onChange={event => setPhoneNumber(event.target.value)}
              placeholder="Ex.: 5511999999999" maxLength={15}
              className="field-control" aria-describedby="pairing-help" required />
            <p id="pairing-help" className="text-xs leading-5 text-slate-500">Exemplo: 55 + DDD + número. Digite somente números, sem +, espaços ou hífens.</p>
            <button type="submit" disabled={requesting || !qr}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-700 disabled:opacity-50 sm:w-auto">
              {requesting ? <Loader2 size={18} className="animate-spin"/> : <Smartphone size={18}/>}
              {requesting ? "Gerando código..." : "Gerar código de conexão"}
            </button>
            {!qr && <p className="text-xs text-amber-800">Aguarde a sessão do WhatsApp ficar pronta para gerar o código.</p>}
          </form>

          {pairingCode && <div role="status" className="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
            <p className="text-sm font-semibold text-indigo-900">Código temporário de vinculação</p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <code className="break-all font-mono text-3xl font-extrabold tracking-[0.14em] text-slate-950" aria-label={"Código " + pairingCode}>{pairingCode}</code>
              <button type="button" onClick={() => void copyCode()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 text-sm font-semibold text-indigo-700">
                {copied ? <Check size={17}/> : <ClipboardCopy size={17}/>}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
            <p className="text-xs leading-5 text-indigo-900">Este código expira. Se não funcionar, solicite outro após o intervalo de segurança.</p>
          </div>}

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-900">Como conectar no mesmo celular</p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
              <li>Gere o código acima e copie ou anote os oito caracteres.</li>
              <li>Abra o WhatsApp neste mesmo celular.</li>
              <li>Toque em <strong>Aparelhos conectados → Conectar aparelho</strong>.</li>
              <li>Escolha <strong>Conectar com número de telefone</strong> e digite o código.</li>
              <li>Volte ao Affiliate Operator e confira se a conexão aparece como ativa.</li>
            </ol>
          </div>
        </div> : qr ? <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="shrink-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <img src={qr} alt="QR Code temporário para vincular o WhatsApp" className="block h-48 w-48"/>
          </div>
          <div className="space-y-2 text-sm leading-6 text-slate-600">
            <p className="font-semibold text-slate-900">Escaneie com o celular principal</p>
            <p>Abra o WhatsApp → Aparelhos conectados → Conectar aparelho e aponte a câmera para esta tela.</p>
          </div>
        </div> : <div className="flex gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          <Loader2 size={20} className="shrink-0 animate-spin text-indigo-600"/>
          Preparando o QR Code...
        </div>}

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800">{error}</p>}
        <p className="text-xs leading-5 text-amber-800">O código de pareamento é privado. Não envie prints dele. A integração Baileys não é oficial e pode apresentar falhas ou restrições da conta.</p>
      </>}
      {statusError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{statusError}</p>}
    </div>
  </section>;
}
