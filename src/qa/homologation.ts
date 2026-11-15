export type QaStatus = "pending" | "passed" | "failed" | "blocked";
export type QaPriority = "P0" | "P1" | "P2";
export type QaCase = { id: number; priority: QaPriority; group: string; title: string; expected: string };

export const MATHEUS_QA_ISSUE = "https://github.com/caueuliani/WhatsApp-Affiliate-Automator/issues/17";

export const QA_CASES: QaCase[] = [
  { id: 1, priority: "P0", group: "Início e segurança", title: "Abrir no Chrome Android", expected: "Dashboard sem rolagem horizontal" },
  { id: 2, priority: "P0", group: "Início e segurança", title: "Entrar com Google autorizado", expected: "Cinco abas acessíveis na barra inferior" },
  { id: 3, priority: "P0", group: "Início e segurança", title: "Conferir bloqueio de conta não autorizada", expected: "Acesso negado sem expor dados" },
  { id: 4, priority: "P0", group: "Início e segurança", title: "Gerar link na Central de Afiliados", expected: "Link criado na conta correta" },
  { id: 5, priority: "P0", group: "Início e segurança", title: "Colar um link meli.la ou /sec", expected: "Importador identifica a oferta" },
  { id: 6, priority: "P0", group: "Início e segurança", title: "Conferir link e parâmetros", expected: "Endereço de afiliado preservado" },
  { id: 7, priority: "P0", group: "Início e segurança", title: "Conferir dados não verificados", expected: "Sem preço, desconto ou comissão inventados" },
  { id: 8, priority: "P0", group: "Início e segurança", title: "Revisar e salvar uma oferta", expected: "Oferta aparece na biblioteca local" },
  { id: 9, priority: "P0", group: "Início e segurança", title: "Importar novamente o mesmo link", expected: "Duplicata identificada e bloqueada" },
  { id: 10, priority: "P0", group: "Início e segurança", title: "Salvar sem publicar", expected: "Nenhuma mensagem enviada automaticamente" },
  { id: 11, priority: "P0", group: "Início e segurança", title: "Exportar backup JSON local", expected: "Arquivo de backup baixado" },
  { id: 12, priority: "P0", group: "Importação em lote", title: "Analisar de 3 a 5 links", expected: "Todos os links válidos aparecem" },
  { id: 13, priority: "P0", group: "Importação em lote", title: "Editar nomes e desmarcar um item", expected: "Seleção respeita os itens marcados" },
  { id: 14, priority: "P0", group: "Importação em lote", title: "Salvar selecionadas", expected: "Só os itens aprovados são cadastrados" },
  { id: 15, priority: "P0", group: "Importação em lote", title: "Repetir o mesmo lote", expected: "Links já salvos reconhecidos" },
  { id: 16, priority: "P0", group: "Importação em lote", title: "Importar link curto sem nome", expected: "Nome real obrigatório antes de salvar" },
  { id: 17, priority: "P0", group: "Importação em lote", title: "Verificar teto de 100 ofertas", expected: "Limite aplicado sem apagar dados" },
  { id: 18, priority: "P0", group: "Importação em lote", title: "Conferir link após backup JSON", expected: "Link com tracking íntegro" },
  { id: 19, priority: "P1", group: "PWA Android", title: "Instalar app pelo Chrome Android", expected: "Ícone do Affiliate Operator aparece" },
  { id: 20, priority: "P1", group: "PWA Android", title: "Usar Compartilhar no Mercado Livre", expected: "Menu de destinos do Android abre" },
  { id: 21, priority: "P1", group: "PWA Android", title: "Encontrar Affiliate Operator no menu", expected: "Aplicativo instalado disponível" },
  { id: 22, priority: "P1", group: "PWA Android", title: "Enviar link pelo menu Compartilhar", expected: "Abre a aba Ofertas com link detectado" },
  { id: 23, priority: "P1", group: "PWA Android", title: "Conferir link compartilhado", expected: "Link preservado e revisão exigida" },
  { id: 24, priority: "P1", group: "PWA Android", title: "Reabrir aplicativo instalado", expected: "Ofertas salvas persistem localmente" },
  { id: 25, priority: "P1", group: "Backup Cloudflare D1", title: "Consultar estado da nuvem", expected: "Mostra revisão ou erro compreensível" },
  { id: 26, priority: "P1", group: "Backup Cloudflare D1", title: "Enviar uma oferta descartável à nuvem", expected: "Confirmação e revisão incrementada" },
  { id: 27, priority: "P1", group: "Backup Cloudflare D1", title: "Abrir outra sessão autorizada", expected: "Revisão e quantidade acessíveis" },
  { id: 28, priority: "P1", group: "Backup Cloudflare D1", title: "Restaurar backup em outro dispositivo", expected: "Ofertas e links íntegros" },
  { id: 29, priority: "P1", group: "Backup Cloudflare D1", title: "Desfazer a última restauração", expected: "Dados locais anteriores recuperados" },
  { id: 30, priority: "P1", group: "Backup Cloudflare D1", title: "Testar conflito com dados descartáveis", expected: "Upload desatualizado recusado sem perda" },
  { id: 31, priority: "P1", group: "Backup Cloudflare D1", title: "Revisar agenda após restauração", expected: "Rotinas coerentes, sem envio automático" },
  { id: 32, priority: "P1", group: "WhatsApp assistido", title: "Verificar os dois modos de conexão", expected: "Mesmo celular e QR Code disponíveis" },
  { id: 33, priority: "P1", group: "WhatsApp assistido", title: "Solicitar código de pareamento", expected: "Código exibido de forma privada" },
  { id: 34, priority: "P1", group: "WhatsApp assistido", title: "Inserir código no WhatsApp", expected: "Vínculo aceito ou erro registrável" },
  { id: 35, priority: "P1", group: "WhatsApp assistido", title: "Conferir status e grupos", expected: "Sessão e destinos listados corretamente" },
  { id: 36, priority: "P1", group: "WhatsApp assistido", title: "Revisar publicação sem disparar", expected: "Mensagem, link e aviso de publicidade" },
  { id: 37, priority: "P1", group: "WhatsApp assistido", title: "Enviar uma mensagem autorizada", expected: "Somente se o grupo e o programa permitirem" },
  { id: 38, priority: "P1", group: "WhatsApp assistido", title: "Avaliar persistência da sessão", expected: "Registrar impacto de suspensão do Render" },
  { id: 39, priority: "P2", group: "Experiência mobile", title: "Navegar com uma mão", expected: "Botões e barra inferior acessíveis" },
  { id: 40, priority: "P2", group: "Experiência mobile", title: "Testar telas estreitas e rotação", expected: "Sem conteúdo cortado" },
  { id: 41, priority: "P2", group: "Experiência mobile", title: "Abrir teclado e editar links", expected: "Campos e ação Salvar utilizáveis" },
  { id: 42, priority: "P2", group: "Experiência mobile", title: "Testar rede lenta e retomada", expected: "Erros claros e dados locais preservados" },
  { id: 43, priority: "P2", group: "Experiência mobile", title: "Colar HTTP, domínio falso e sem título", expected: "URLs incorretas bloqueadas" },
  { id: 44, priority: "P2", group: "Experiência mobile", title: "Revisar autorização para divulgar", expected: "Publicidade e regras respeitadas" },
  { id: 45, priority: "P2", group: "Experiência mobile", title: "Conferir limites de automação", expected: "Sem prometer API oficial nem publicação automática" },
];

export type QaProgress = Partial<Record<number, Exclude<QaStatus, "pending">>>;

export function qaKey(uid: string): string {
  return "affiliate-operator:homologation:v1:" + uid;
}

export function parseQaProgress(raw: string | null): QaProgress {
  if (!raw || raw.length > 10_000) return {};
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const doc = data as Record<string, unknown>;
    if (doc.version !== 1 || !doc.statuses || typeof doc.statuses !== "object" || Array.isArray(doc.statuses)) return {};
    const statuses = doc.statuses as Record<string, unknown>;
    const allowed = new Set(QA_CASES.map(t => String(t.id)));
    return Object.fromEntries(Object.entries(statuses)
      .filter(([id, status]) => allowed.has(id) && ["passed", "failed", "blocked"].includes(String(status)))
      .map(([id, status]) => [Number(id), status])) as QaProgress;
  } catch { return {}; }
}

export function serializeQaProgress(progress: QaProgress): string {
  return JSON.stringify({ version: 1, statuses: progress });
}

export function qaTotals(progress: QaProgress) {
  const statuses = QA_CASES.map(test => progress[test.id] || "pending");
  return {
    total: statuses.length,
    passed: statuses.filter(s => s === "passed").length,
    failed: statuses.filter(s => s === "failed").length,
    blocked: statuses.filter(s => s === "blocked").length,
    pending: statuses.filter(s => s === "pending").length,
  };
}

export function exportQaReport(progress: QaProgress): string {
  const totals = qaTotals(progress);
  const icon: Record<QaStatus, string> = { pending: "Pendente", passed: "OK", failed: "Falhou", blocked: "Bloqueado" };
  return [
    "# Homologação Affiliate Operator — Matheus",
    "",
    "Resultado: " + totals.passed + "/" + totals.total + " OK; " + totals.failed + " falharam; " + totals.blocked + " bloqueados; " + totals.pending + " pendentes.",
    "Checklist: " + MATHEUS_QA_ISSUE,
    "",
    ...QA_CASES.map(item => String(item.id).padStart(2, "0") + ". [" + item.priority + "] [" + icon[progress[item.id] ?? "pending"] + "] " + item.title),
    "",
    "Relatório de status sem links de afiliado, números de telefone ou códigos de pareamento.",
  ].join("\n");
}
