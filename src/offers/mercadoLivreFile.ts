import { MAX_ML_IMPORT_ITEMS, MAX_ML_IMPORT_TEXT, parseMercadoLivreLink, extractMercadoLivreOffers, type MercadoLivreCandidate } from "./mercadoLivre";

/**
 * Local-only import. A CSV is merely a user-provided list of links, NOT
 * an official Mercado Livre Central de Afiliados export/API.
 * Never resolve redirects, fetch URLs, create tracking parameters, or infer prices.
 */
const TITLE_NAMES = new Set(["produto", "nome", "nome do produto", "titulo", "titulo do produto", "title", "product", "product name"]);
const LINK_NAMES = new Set(["link", "url", "link de afiliado", "link afiliado", "url de afiliado", "affiliate url", "affiliate link", "product url"]);
const normalizeHeader = (value: string): string => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

function readDelimited(text: string, delimiter: "," | ";"): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; closedQuote = true; }
      } else cell += ch;
    } else if (ch === '"' && !cell.trim() && !closedQuote) {
      quoted = true; cell = "";
    } else if (ch === delimiter) {
      row.push(cell.trim()); cell = ""; closedQuote = false;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(v => v !== "")) result.push(row);
      row = []; cell = ""; closedQuote = false;
    } else if (ch === '"') {
      // A quote inside an unquoted field is malformed CSV.
      throw new Error("CSV inválido: aspas inesperadas. Exporte usando campos entre aspas quando necessário.");
    } else if (closedQuote && ch !== " " && ch !== "\t") {
      throw new Error("CSV inválido: caracteres após aspas de fechamento.");
    } else {
      cell += ch;
    }
  }
  if (quoted) throw new Error("CSV inválido: aspas não foram fechadas.");
  row.push(cell.trim());
  if (row.some(v => v !== "")) result.push(row);
  return result;
}

function parseCsv(text: string): MercadoLivreCandidate[] {
  const sanitized = text.replace(/^\uFEFF/, "");
  const headerLine = sanitized.split(/\r?\n/, 1)[0] ?? "";
  const delimiter: "," | ";" = headerLine.includes(";") ? ";" : ",";
  const rows = readDelimited(sanitized, delimiter);
  if (rows.length < 2) throw new Error("CSV sem ofertas. Inclua o cabeçalho e uma linha por produto.");
  const header = rows[0].map(normalizeHeader);
  const urlIndex = header.findIndex(h => LINK_NAMES.has(h));
  const titleIndex = header.findIndex(h => TITLE_NAMES.has(h));
  if (urlIndex < 0) {
    throw new Error("CSV sem coluna de link. Use o cabeçalho: produto;link");
  }
  if (rows.length - 1 > MAX_ML_IMPORT_ITEMS) {
    throw new Error("Limite de 20 linhas por importação. Divida o arquivo em lotes menores.");
  }
  const candidates: MercadoLivreCandidate[] = [];
  const seen = new Set<string>();
  for (const [index, row] of rows.slice(1).entries()) {
    if (row.length !== header.length) throw new Error("CSV: número de colunas incorreto na linha " + (index + 2) + ".");
    let parsed: ReturnType<typeof parseMercadoLivreLink>;
    try { parsed = parseMercadoLivreLink(row[urlIndex] ?? ""); }
    catch { throw new Error("Link inválido ou fora dos domínios oficiais do Mercado Livre na linha " + (index + 2) + "."); }
    if (seen.has(parsed.link)) continue;
    seen.add(parsed.link);
    const suppliedTitle = titleIndex >= 0 ? (row[titleIndex] ?? "").trim() : "";
    const titleSuggestion = suppliedTitle.length <= 120 && suppliedTitle.length > 0
      ? suppliedTitle
      : "Produto do Mercado Livre (revisar)";
    candidates.push({ ...parsed, titleSuggestion });
  }
  if (!candidates.length) throw new Error("Arquivo CSV sem links válidos.");
  return candidates;
}

export function readMercadoLivreImportFile(text: string, fileName: string): MercadoLivreCandidate[] {
  if (text.length > MAX_ML_IMPORT_TEXT) throw new Error("Arquivo excede 12 mil caracteres. Divida a lista em arquivos menores.");
  const name = fileName.trim().toLowerCase();
  if (name.endsWith(".txt")) return extractMercadoLivreOffers(text);
  if (name.endsWith(".csv")) return parseCsv(text);
  throw new Error("Formato não suportado. Selecione um arquivo CSV ou TXT.");
}
