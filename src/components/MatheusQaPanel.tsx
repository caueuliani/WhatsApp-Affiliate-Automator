import { useEffect, useMemo, useState } from "react";
import { ClipboardCopy, ClipboardCheck, ClipboardList, ExternalLink, RotateCcw, ShieldCheck } from "lucide-react";
import { exportQaReport, MATHEUS_QA_ISSUE, parseQaProgress, qaKey, qaTotals, QA_CASES, serializeQaProgress, type QaProgress, type QaStatus } from "../qa/homologation";

type Props = { uid: string };
const options: { value: QaStatus; label: string }[] = [
  { value: "pending", label: "Pendente" },
  { value: "passed", label: "OK" },
  { value: "failed", label: "Falhou" },
  { value: "blocked", label: "Bloqueado" },
];

export default function MatheusQaPanel({ uid }: Props) {
  const [progress, setProgress] = useState<QaProgress>(() => {
    try { return parseQaProgress(localStorage.getItem(qaKey(uid))); }
    catch { return {}; }
  });
  const [copied, setCopied] = useState(false);
  const [storageError, setStorageError] = useState("");
  const totals = qaTotals(progress);
  const groups = useMemo(() => {
    const map = new Map<string, typeof QA_CASES[number][]>();
    for (const item of QA_CASES) {
      const key = item.priority + " · " + item.group;
      const entries = map.get(key) || [];
      entries.push(item);
      map.set(key, entries);
    }
    return [...map.entries()].map(([name, cases]) => ({ name, cases }));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(qaKey(uid), serializeQaProgress(progress));
      setStorageError("");
    } catch {
      setStorageError("Não foi possível salvar o checklist neste navegador. Copie seu relatório antes de sair.");
    }
  }, [uid, progress]);

  const changeStatus = (id: number, status: QaStatus) => {
    setCopied(false);
    setProgress(previous => {
      const next = { ...previous };
      if (status === "pending") delete next[id];
      else next[id] = status;
      return next;
    });
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(exportQaReport(progress));
      setCopied(true);
    } catch {
      // The report is downloadable if clipboard permissions are unavailable.
      setCopied(false);
      setStorageError("Permissão de copiar indisponível. Use Baixar relatório como alternativa.");
    }
  };

  const downloadReport = () => {
    const url = URL.createObjectURL(new Blob([exportQaReport(progress)], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "homologacao-affiliate-operator-matheus.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const clear = () => {
    if (!window.confirm("Zerar somente os status de testes deste dispositivo? Isso NÃO altera suas ofertas, agenda, backups ou conexões.")) return;
    setProgress({});
    setCopied(false);
  };

  return <details className="surface-card group overflow-hidden" aria-labelledby="homologation-heading">
    <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4 sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="shrink-0 rounded-xl bg-amber-50 p-2 text-amber-800"><ClipboardList size={23}/></div>
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-wide text-amber-800">Roteiro de homologação</p>
          <h2 id="homologation-heading" className="mt-1 text-lg font-extrabold text-slate-950">To Do do Matheus</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">45 verificações: Mercado Livre, importação em lote, PWA, D1, WhatsApp e experiência mobile.</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-700">
            <span>{totals.passed}/{totals.total} OK</span>
            <span>{totals.failed} falhas</span>
            <span>{totals.blocked} bloqueados</span>
            <span>{totals.pending} pendentes</span>
          </div>
          <div className="mt-3 h-2 w-full max-w-sm overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: (totals.passed / totals.total) * 100 + "%" }}/>
          </div>
        </div>
      </div>
      <span className="shrink-0 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 group-open:hidden">Abrir</span>
      <span className="hidden shrink-0 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 group-open:inline">Fechar</span>
    </summary>
    <div className="space-y-4 border-t border-slate-100 px-3 pb-5 pt-4 sm:px-5">
      <p className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">
        Comece pelos testes <strong>P0</strong>. Em cada item, escolha <strong>OK, Falhou ou Bloqueado</strong>. Você não precisa testar tudo de uma vez. Os status ficam salvos somente neste navegador e conta Google. Não cole códigos, números de telefone ou links reais no relatório.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void copyReport()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">
          {copied ? <ClipboardCheck size={17}/> : <ClipboardCopy size={17}/>}
          {copied ? "Relatório copiado" : "Copiar relatório"}
        </button>
        <button type="button" onClick={downloadReport}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
          Baixar relatório
        </button>
        <a href={MATHEUS_QA_ISSUE} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-indigo-700 hover:underline">
          Abrir roteiro completo <ExternalLink size={16}/>
        </a>
      </div>
      {storageError && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{storageError}</p>}
      <div className="space-y-3">
        {groups.map(group => {
          const done = group.cases.filter(test => progress[test.id] === "passed").length;
          return <details key={group.name}  className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-900 sm:px-4">
              <span className="min-w-0 break-words">{group.name}</span>
              <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700">{done}/{group.cases.length} OK</span>
            </summary>
            <div className="divide-y divide-slate-100">
              {group.cases.map(item => <div key={item.id} className="flex min-w-0 flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{String(item.id).padStart(2, "0")}. {item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">Esperado: {item.expected}</p>
                </div>
                <label className="shrink-0 space-y-1 text-xs text-slate-600 sm:w-36">
                  <span className="sr-only">Status do teste {item.id}</span>
                  <select value={progress[item.id] || "pending"} onChange={event => changeStatus(item.id, event.target.value as QaStatus)}
                    aria-label={"Status do teste " + item.id} className="field-control min-h-11 w-full bg-white text-sm font-semibold">
                    {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </div>)}
            </div>
          </details>;
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
        <span className="flex items-start gap-2"><ShieldCheck size={17} className="mt-0.5 shrink-0"/> Antes de enviar WhatsApp, confira as regras do grupo e do programa. Faça backups antes de sobrescrever dados.</span>
        <button type="button" onClick={clear} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100">
          <RotateCcw size={16}/> Zerar status
        </button>
      </div>
    </div>
  </details>;
}
