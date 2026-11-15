import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readMercadoLivreImportFile } from "../src/offers/mercadoLivreFile";
import { createImportDraft } from "../src/offers/mercadoLivre";

test("CSV do usuário importa 2 URLs preservando tracking original e título", () => {
  const csv = "\uFEFFproduto;link\r\n\"Headset; Bluetooth\";\"https://meli.la/AbCd?tag=a%2Bb\"\r\nMouse Gamer;https://mercadolivre.com/sec/5xyz?ref=9%2F1\r\n";
  const found = readMercadoLivreImportFile(csv, "meus-links.csv");
  assert.equal(found.length, 2);
  assert.equal(found[0].titleSuggestion, "Headset; Bluetooth");
  assert.equal(found[0].link, "https://meli.la/AbCd?tag=a%2Bb");
  assert.equal(found[1].link, "https://mercadolivre.com/sec/5xyz?ref=9%2F1");
  const draft = createImportDraft(found[0]);
  assert.equal(draft.price, "");
  assert.equal(draft.link, found[0].link);
});

test("CSV com vírgulas e nome de coluna alternativo; nenhum preço do arquivo é usado", () => {
  const csv = 'title,affiliate_url,price\n"Teclado, mecânico",https://meli.la/xx1,1000\n';
  const found = readMercadoLivreImportFile(csv, "teste.CSV");
  assert.equal(found[0].titleSuggestion, "Teclado, mecânico");
  assert.equal(createImportDraft(found[0]).price, "");
});

test("TXT permite compartilhar URLs e mensagens", () => {
  const found = readMercadoLivreImportFile("Cabo USB\nhttps://meli.la/ABC1\n\nMouse Gamer\nhttps://meli.la/ABC2", "ofertas.txt");
  assert.equal(found.length, 2);
  assert.equal(found[0].titleSuggestion, "Cabo USB");
});

test("CSV rejeita links fora do Mercado Livre, cabeçalho ausente e estruturas malformadas", () => {
  assert.throws(() => readMercadoLivreImportFile("produto;link\nFalso;https://meli.la.evil.net/a", "links.csv"), /Link inválido/);
  assert.throws(() => readMercadoLivreImportFile("produto;preco\nFone;100", "links.csv"), /sem coluna/);
  assert.throws(() => readMercadoLivreImportFile('produto;link\n"sem fim;https://meli.la/abc', "links.csv"), /aspas/);
  assert.throws(() => readMercadoLivreImportFile("produto;link\nFone;https://meli.la/abc;outra", "links.csv"), /colunas/);
  assert.throws(() => readMercadoLivreImportFile("produto;link\nFone;https://meli.la/abc", "links.json"), /Formato/);
});

test("CSV usa nome placeholder se não houver título e deduplica links idênticos", () => {
  const found=readMercadoLivreImportFile("link\nhttps://meli.la/abc\nhttps://meli.la/abc", "links.csv");
  assert.equal(found.length,1);
  assert.equal(found[0].titleSuggestion,"Produto do Mercado Livre (revisar)");
});

test("limite 20 linhas e 12 mil caracteres protege o app", () => {
  const rows = Array.from({ length: 21 }, (_, i) => "Produto" + i + ";https://meli.la/abcd" + i).join("\n");
  assert.throws(() => readMercadoLivreImportFile("produto;link\n" + rows, "links.csv"), /20 linhas/);
  assert.throws(() => readMercadoLivreImportFile("x".repeat(12001), "links.txt"), /12 mil/);
});

test("campo CSV escapado e quebra de linha dentro de título", () => {
  const found = readMercadoLivreImportFile('produto;link\n"Fone ""modelo X""\nsem fio";https://meli.la/9abc\n', "links.csv");
  assert.equal(found.length, 1);
  assert.equal(found[0].titleSuggestion, 'Fone "modelo X"\nsem fio');
});
