import React, { useEffect, useState } from "react";
import { Cloud, CloudDownload, CloudUpload, DatabaseZap, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { parseCloudSnapshot, readLocalCloudSnapshot, recoveryIsAvailable, restoreCloudToLocal, undoCloudRestore, type CloudSnapshot, type CloudSaveInput } from "../cloud/state";

type Props = {
  uid: string;
  loadState: () => Promise<unknown>;
  saveState: (state: CloudSaveInput) => Promise<{ ok: boolean; revision: number }>;
};

export default function CloudSyncPanel({ uid, loadState, saveState }: Props) {
  const [remote, setRemote] = useState<CloudSnapshot | null>(null);
  const [busy, setBusy] = useState<"" | "refresh" | "upload" | "download" | "undo">("refresh");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [undoAvailable, setUndoAvailable] = useState(() => recoveryIsAvailable(uid, localStorage));

  useEffect(() => {
    let alive = true;
    void loadState().then(parseCloudSnapshot).then(result => {
      if (alive) { setRemote(result); setError(""); }
    }).catch(err => {
      if (alive) setError(err instanceof Error ? err.message : "Cloudflare indisponível.");
    }).finally(() => { if (alive) setBusy(""); });
    return () => { alive = false; };
  }, [uid, loadState]);

  const refresh = async () => {
    setBusy("refresh"); setError(""); setNotice("");
    try {
      setRemote(parseCloudSnapshot(await loadState()));
      setNotice("Estado da nuvem atualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível consultar a nuvem.");
    } finally { setBusy(""); }
  };

  const upload = async () => {
    if (busy) return;
    setBusy("upload"); setError(""); setNotice("");
    try {
      const local = readLocalCloudSnapshot(uid, localStorage);
      if (!local.offers.length && !local.rules.length) {
        throw new Error("Biblioteca local vazia. Não enviaremos um estado vazio que poderia apagar ofertas na nuvem.");
      }
      const latest = parseCloudSnapshot(await loadState());
      const overwrite = latest.revision > 0;
      const msg = overwrite
        ? "ATENÇÃO: os " + latest.offers.length + " produtos e " + latest.rules.length + " rotinas que já estão no D1 serão substituídos pela biblioteca deste navegador (" + local.offers.length + " produtos, " + local.rules.length + " rotinas). Se outro dispositivo tiver mudanças novas, elas serão perdidas. Continuar?"
        : "Enviar " + local.offers.length + " ofertas e " + local.rules.length + " rotinas deste navegador para o Cloudflare D1? Esta ação NÃO publica mensagens.";
      if (!window.confirm(msg)) return;
      // Re-read before confirmation and send a real atomic expectedRevision to D1.
      const beforeWrite = parseCloudSnapshot(await loadState());
      if (beforeWrite.revision !== latest.revision) {
        throw new Error("A nuvem mudou durante sua confirmação. Atualize os dados antes de substituir.");
      }
      const result = await saveState({ ...local, expectedRevision: beforeWrite.revision });
      if (!result.ok || !Number.isSafeInteger(result.revision)) {
        throw new Error("A nuvem não confirmou a gravação. Não alteramos os dados locais.");
      }
      setRemote({ ...local, revision: result.revision });
      setNotice("Backup salvo na nuvem (revisão " + result.revision + "). O envio de mensagens continua manual.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no envio à nuvem.");
    } finally { setBusy(""); }
  };

  const download = async () => {
    if (busy) return;
    setBusy("download"); setError(""); setNotice("");
    try {
      const latest = parseCloudSnapshot(await loadState());
      setRemote(latest);
      if (latest.revision === 0 || (!latest.offers.length && !latest.rules.length)) {
        throw new Error("A nuvem ainda não tem um backup para restaurar.");
      }
      const local = readLocalCloudSnapshot(uid, localStorage);
      const msg = "Restaurar " + latest.offers.length + " ofertas e " + latest.rules.length + " rotinas da nuvem? Isso substituirá os " + local.offers.length + " produtos e " + local.rules.length + " rotinas DESTE NAVEGADOR. Um backup de recuperação será criado aqui. Rascunhos ainda não salvos serão perdidos. Confirmar?";
      if (!window.confirm(msg)) return;
      restoreCloudToLocal(uid, latest, localStorage);
      setUndoAvailable(true);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao restaurar.");
    } finally { setBusy(""); }
  };

  const undo = () => {
    if (busy || !window.confirm("Desfazer a última restauração da nuvem e voltar aos dados que estavam neste navegador antes dela? Alterações locais posteriores serão perdidas.")) return;
    setBusy("undo"); setError("");
    try {
      undoCloudRestore(uid, localStorage);
      setUndoAvailable(false);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível desfazer a restauração.");
    } finally { setBusy(""); }
  };

  return <details className="surface-card group overflow-hidden" aria-label="Backup na nuvem">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-bold text-slate-900 sm:p-5">
      <span className="flex items-center gap-3">
        <span className="rounded-xl bg-indigo-50 p-2 text-indigo-700"><Cloud size={21}/></span>
        <span>
          <span className="block text-sm sm:text-base">Backup entre celular e computador</span>
          <span className="mt-1 block text-xs font-medium text-slate-500">
            {busy === "refresh" ? "Consultando Cloudflare D1..." : remote ? "Nuvem: revisão " + remote.revision + " · " + remote.offers.length + " ofertas" : "Cloudflare D1 · Verificar conexão"}
          </span>
        </span>
      </span>
      <span className="text-xs font-semibold text-indigo-700 group-open:hidden">Abrir</span>
      <span className="hidden text-xs font-semibold text-indigo-700 group-open:inline">Fechar</span>
    </summary>
    <div className="space-y-4 border-t border-slate-100 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
      <p className="text-sm leading-6 text-slate-700">
        A biblioteca ainda funciona localmente. Use estes comandos quando quiser transferir suas ofertas e agenda entre celular e computador. <strong>Não é sincronização automática:</strong> cada transferência é confirmada por você.
      </p>
      {remote && <p className="rounded-xl bg-indigo-50 p-3 text-sm leading-6 text-indigo-900">
        Na nuvem: <strong>{remote.offers.length} ofertas</strong> e <strong>{remote.rules.length} rotinas</strong> · revisão {remote.revision}.
      </p>}
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <button disabled={!!busy} type="button" onClick={() => void upload()}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
          {busy === "upload" ? <Loader2 size={18} className="animate-spin"/> : <CloudUpload size={18}/>} Enviar para a nuvem
        </button>
        <button disabled={!!busy} type="button" onClick={() => void download()}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {busy === "download" ? <Loader2 size={18} className="animate-spin"/> : <CloudDownload size={18}/>} Restaurar da nuvem
        </button>
        <button disabled={!!busy} type="button" onClick={() => void refresh()}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          <DatabaseZap size={18}/> Atualizar estado
        </button>
      </div>
      {undoAvailable && <button disabled={!!busy} type="button" onClick={undo}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 disabled:opacity-50">
        <RotateCcw size={17}/> Desfazer última restauração
      </button>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">{notice}</p>}
      <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-700">
        <ShieldCheck size={17} className="mt-0.5 shrink-0 text-slate-500"/>
        <span>Somente sua conta Google autorizada pode acessar seus dados. O token privado da Cloudflare fica exclusivamente no backend. As gravações verificam a revisão do D1: se outro aparelho atualizar os dados primeiro, o upload será recusado sem apagar ofertas. Ainda é necessário restaurar e enviar manualmente; não existe sincronização automática.</span>
      </div>
    </div>
  </details>;
}
