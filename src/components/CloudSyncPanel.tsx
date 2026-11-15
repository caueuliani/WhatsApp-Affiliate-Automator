import React, { useEffect, useState } from "react";
import { Cloud, CloudDownload, CloudUpload, DatabaseZap, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { parseCloudSnapshot, readLocalCloudSnapshot, recoveryIsAvailable, restoreCloudToLocal, undoCloudRestore, type CloudSnapshot, type CloudSaveInput } from "../cloud/state";
import { autoSyncEnabled, disableAutoSync, enableAutoSync, getAutoSyncStatus, markManualBaseline, type SyncStatus } from "../cloud/autoSync";

type Props = {
  uid: string;
  loadState: () => Promise<unknown>;
  saveState: (state: CloudSaveInput) => Promise<{ ok: boolean; revision: number }>;
};

export default function CloudSyncPanel({ uid, loadState, saveState }: Props) {
  const [remote, setRemote] = useState<CloudSnapshot | null>(null);
  const [busy, setBusy] = useState<"" | "refresh" | "upload" | "download" | "undo" | "auto">("refresh");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [undoAvailable, setUndoAvailable] = useState(() => recoveryIsAvailable(uid, localStorage));
  const [autoActive, setAutoActive] = useState(() => autoSyncEnabled(uid, localStorage));
  const [autoStatus, setAutoStatus] = useState<SyncStatus | null>(() => getAutoSyncStatus(uid, localStorage));

  useEffect(() => {
    const update = () => {
      setAutoActive(autoSyncEnabled(uid, localStorage));
      setAutoStatus(getAutoSyncStatus(uid, localStorage));
    };
    window.addEventListener("affiliate-operator:sync-status", update);
    window.addEventListener("affiliate-operator:sync-toggle", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("affiliate-operator:sync-status", update);
      window.removeEventListener("affiliate-operator:sync-toggle", update);
      window.removeEventListener("storage", update);
    };
  }, [uid]);


  useEffect(() => {
    let alive = true;
    void loadState().then(parseCloudSnapshot).then(result => {
      if (alive) { setRemote(result); setError(""); }
    }).catch(err => {
      if (alive) setError(err instanceof Error ? err.message : "Cloudflare indisponível.");
    }).finally(() => { if (alive) setBusy(""); });
    return () => { alive = false; };
  }, [uid, loadState]);

  const toggleAuto = async () => {
    if (busy) return;
    setError(""); setNotice("");
    if (autoSyncEnabled(uid, localStorage)) {
      disableAutoSync(uid, localStorage);
      setAutoActive(false);
      setNotice("Backup automático desativado. A biblioteca local continua disponível.");
      return;
    }
    setBusy("auto");
    try {
      const latest = parseCloudSnapshot(await loadState());
      setRemote(latest);
      if (!window.confirm("Ativar backup automático a cada 30 segundos quando houver alterações locais? Os dados atuais precisam ser iguais aos da nuvem. Mudanças feitas em outro dispositivo NÃO serão restauradas automaticamente; exigirão sua confirmação.")) return;
      await enableAutoSync(uid, localStorage, latest);
      setAutoActive(true);
      setNotice("Backup automático ativado. Se houver divergência entre aparelhos, será interrompido para revisão.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ativar o backup automático.");
    } finally { setBusy(""); }
  };

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
      disableAutoSync(uid, localStorage, "Backup automático pausado devido ao envio manual. Reative após conferir o resultado.");
      // Re-read before confirmation and send a real atomic expectedRevision to D1.
      const beforeWrite = parseCloudSnapshot(await loadState());
      if (beforeWrite.revision !== latest.revision) {
        throw new Error("A nuvem mudou durante sua confirmação. Atualize os dados antes de substituir.");
      }
      const result = await saveState({ ...local, expectedRevision: beforeWrite.revision });
      if (!result.ok || !Number.isSafeInteger(result.revision)) {
        throw new Error("A nuvem não confirmou a gravação. Não alteramos os dados locais.");
      }
      await markManualBaseline(uid, localStorage, local, result.revision);
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
      disableAutoSync(uid, localStorage, "Backup automático pausado para restauração manual.");
      restoreCloudToLocal(uid, latest, localStorage);
      await markManualBaseline(uid, localStorage, latest, latest.revision);
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
      disableAutoSync(uid, localStorage, "Backup automático pausado ao desfazer restauração.");
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
        A biblioteca funciona localmente. As opções abaixo transferem ofertas e agenda de forma manual. Você também pode <strong>ativar o backup automático seguro</strong>: ele envia alterações locais somente quando a nuvem permanece na revisão conhecida e <strong>nunca baixa alterações de outro aparelho sem aprovação</strong>.
      </p>
      {remote && <p className="rounded-xl bg-indigo-50 p-3 text-sm leading-6 text-indigo-900">
        Na nuvem: <strong>{remote.offers.length} ofertas</strong> e <strong>{remote.rules.length} rotinas</strong> · revisão {remote.revision}.
      </p>}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 sm:p-4">
        <p className="text-sm font-bold text-indigo-950">Backup automático seguro (opcional)</p>
        <p className="mt-1 text-xs leading-5 text-indigo-900">
          Quando ativo, verifica o D1 periodicamente e envia apenas alterações locais sem conflitos. Se houver alterações remotas, pausa e pede revisão: não substitui suas ofertas nem rascunhos automaticamente.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" disabled={!!busy} onClick={() => void toggleAuto()}
            className={"inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50 " + (autoActive ? "border border-amber-200 bg-white text-amber-900" : "bg-indigo-600 text-white hover:bg-indigo-700")}>
            {autoActive ? "Desativar backup automático" : "Ativar backup automático"}
          </button>
          <span className="text-xs font-semibold text-indigo-900">{autoActive ? "Ativo · intervalo de 30 segundos" : "Desativado"}</span>
        </div>
        {autoStatus && <p role="status" className={"mt-2 text-xs leading-5 " + (["conflict","invalid","remote_updated"].includes(autoStatus.state) ? "text-amber-950 font-semibold" : "text-indigo-900")}>
          {autoStatus.message}
        </p>}
        <p className="mt-2 text-xs text-indigo-800">Antes de ativar, confira se as ofertas deste navegador são iguais às da nuvem. Se forem diferentes, use os controles manuais abaixo e revise o resultado.</p>
      </div>
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
