import { test, expect } from "@playwright/test";

const offersKey = "affiliate-operator:offers:v1:e2e-test-only";
const cloudKey = "affiliate-operator:e2e-d1-fixture";

const storedOffers = page => page.evaluate(key => {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw).offers : [];
}, offersKey);

test.beforeEach(async ({ page }) => {
  // Each Playwright test gets a fresh browser context and a fictitious operator UID.
  await page.goto("/e2e/fixture.html");
  await expect(page.getByRole("heading", { name: "Fixture E2E — Ofertas" })).toBeVisible();
});

test("importa um link com tracking intacto e rejeita duplicação", async ({ page }) => {
  const link = "https://meli.la/E2Ealpha?tag=p%2B1&source=android";
  await page.getByRole("textbox", { name: "Links ou mensagens de compartilhamento" })
    .fill("Fone Bluetooth Premium\n" + link);
  await page.getByRole("button", { name: "Analisar links" }).click();
  await expect(page.getByText(link, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Revisar individualmente" }).click();
  await expect(page.locator("#offer-editor input[type='url']")).toHaveValue(link);
  await expect(page.locator("#offer-editor input[id='offer-title']")).toHaveValue("Fone Bluetooth Premium");
  await page.getByRole("button", { name: "Adicionar à biblioteca" }).click();

  await expect.poll(async () => (await storedOffers(page)).length).toBe(1);
  const offers = await storedOffers(page);
  expect(offers[0].link).toBe(link);
  expect(offers[0].priceCents).toBe(null);
  expect(offers[0].message).toContain("Publicidade");
  expect(offers[0].affiliateProgram).toBe("mercado_livre");

  await page.getByRole("button", { name: "Analisar links" }).click();
  await expect(page.getByText("Já salva", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar oferta salva" })).toBeVisible();
  expect((await storedOffers(page)).length).toBe(1);
});

test("seleciona só dois itens do lote, revisa nomes e mantém as URLs", async ({ page }) => {
  const data = [
    "Mouse Gamer", "https://meli.la/E2Emouse?tag=one%2Btwo",
    "Teclado Mecânico", "https://meli.la/E2Ekeyboard?tag=b",
    "Cabo USB", "https://meli.la/E2Ecable?tag=c",
  ].join("\n");
  await page.getByRole("textbox", { name: "Links ou mensagens de compartilhamento" }).fill(data);
  await page.getByRole("button", { name: "Analisar links" }).click();
  await expect(page.locator("article")).toHaveCount(3);
  const articles = page.locator("article");
  await articles.nth(0).getByRole("checkbox", { name: "Selecionar para o lote" }).check();
  await articles.nth(1).getByRole("checkbox", { name: "Selecionar para o lote" }).check();
  await articles.nth(1).getByRole("textbox", { name: "Nome do produto (revisar)" }).fill("Teclado Mecânico Revisado");
  const requests = [];
  page.on("request", request => { if (request.url().includes("/api/share")) requests.push(request.url()); });
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Salvar 2 selecionadas" }).click();

  await expect.poll(async () => (await storedOffers(page)).length).toBe(2);
  const offers = await storedOffers(page);
  expect(offers.map(offer => offer.link).sort()).toEqual([
    "https://meli.la/E2Emouse?tag=one%2Btwo",
    "https://meli.la/E2Ekeyboard?tag=b",
  ].sort());
  expect(offers.map(offer => offer.title)).toContain("Teclado Mecânico Revisado");
  expect(offers.every(offer => offer.priceCents === null)).toBe(true);
  expect(requests).toEqual([]);
});

test("importa CSV local, rejeita links falsos e exige nome real para URL curta", async ({ page }) => {
  const csv = [
    "produto;link",
    "Monitor Fictício;https://meli.la/E2Emonitor?tag=from%2Fcsv",
    "Suporte VESA;https://mercadolivre.com/sec/E2Evesa?campaign=approved",
  ].join("\n");
  await page.getByLabel("Selecionar arquivo CSV ou TXT com links do Mercado Livre")
    .setInputFiles({ name: "ofertas.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.locator("article")).toHaveCount(2);
  await page.getByRole("button", { name: "Selecionar com nome" }).click();
  await page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Salvar 2 selecionadas" }).click();
  await expect.poll(async () => (await storedOffers(page)).length).toBe(2);

  await page.getByRole("textbox", { name: "Links ou mensagens de compartilhamento" })
    .fill("https://meli.la.evil.test/hijack");
  await page.getByRole("button", { name: "Analisar links" }).click();
  await expect(page.getByRole("alert")).toContainText("Nenhum link oficial do Mercado Livre");
  expect((await storedOffers(page)).length).toBe(2);

  await page.getByRole("textbox", { name: "Links ou mensagens de compartilhamento" })
    .fill("https://meli.la/E2Euntitled");
  await page.getByRole("button", { name: "Analisar links" }).click();
  await page.getByRole("button", { name: "Selecionar com nome" }).click();
  await expect(page.getByRole("button", { name: "Salvar 0 selecionadas" })).toBeDisabled();
  const row = page.locator("article").first();
  await row.getByRole("textbox", { name: "Nome do produto (revisar)" }).fill("Produto real revisado");
  await row.getByRole("checkbox", { name: "Selecionar para o lote" }).check();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Salvar 1 selecionada" }).click();
  await expect.poll(async () => (await storedOffers(page)).length).toBe(3);
});

test("restaura backup local da nuvem simulada e permite desfazer", async ({ page }) => {
  const link = "https://meli.la/E2Ebackup?tag=keep%2Fme";
  await page.getByRole("textbox", { name: "Links ou mensagens de compartilhamento" })
    .fill("Produto backup\n" + link);
  await page.getByRole("button", { name: "Analisar links" }).click();
  await page.getByRole("button", { name: "Revisar individualmente" }).click();
  await page.getByRole("button", { name: "Adicionar à biblioteca" }).click();
  await expect.poll(async () => (await storedOffers(page)).length).toBe(1);

  const panel = page.locator('details[aria-label="Backup na nuvem"]');
  await panel.locator("summary").click();
  await expect(panel.getByText(/Nuvem: revisão 0/)).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await panel.getByRole("button", { name: "Enviar para a nuvem" }).click();
  await expect(panel.getByText(/Nuvem: revisão 1/)).toBeVisible();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).offers[0].link, cloudKey)).toBe(link);

  // Simulate a different local snapshot. The UI should save an undo point and reload.
  await page.evaluate(key => {
    const data = JSON.parse(localStorage.getItem(key));
    data.offers[0].title = "Alteração local descartável";
    localStorage.setItem(key, JSON.stringify(data));
  }, offersKey);
  page.once("dialog", dialog => dialog.accept());
  await panel.getByRole("button", { name: "Restaurar da nuvem" }).click();
  await expect.poll(async () => (await storedOffers(page))[0]?.title).toBe("Produto backup");
  const undo = page.getByRole("button", { name: "Desfazer última restauração" });
  await page.locator('details[aria-label="Backup na nuvem"] summary').click();
  await expect(undo).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await undo.click();
  await expect.poll(async () => (await storedOffers(page))[0]?.title).toBe("Alteração local descartável");
});

test("mobile: importador e ações de revisão sem rolagem horizontal na tela", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  await page.getByRole("textbox", { name: "Links ou mensagens de compartilhamento" })
    .fill("Oferta de celular\nhttps://meli.la/E2Emobile?tracking=abc");
  await page.getByRole("button", { name: "Analisar links" }).click();
  await expect(page.getByRole("button", { name: "Revisar individualmente" })).toBeVisible();
  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
});


test("catálogo: categorias, busca com acentos, filtros e ação em lote sem mudar rastreamento", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const data = [
    "Mouse Gamer", "https://meli.la/E2Ecatmouse?tag=af%2Bmouse",
    "Teclado Mecânico", "https://meli.la/E2Ecatkeyboard?tag=af%2Bkeyboard",
    "Cabo USB", "https://meli.la/E2Ecatcable?tag=af%2Bcable",
  ].join("\n");
  await page.getByRole("textbox", { name: "Links ou mensagens de compartilhamento" }).fill(data);
  await page.getByRole("button", { name: "Analisar links" }).click();
  await page.getByRole("button", { name: "Selecionar com nome" }).click();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Salvar 3 selecionadas" }).click();
  await expect.poll(async () => (await storedOffers(page)).length).toBe(3);

  const catalog = page.getByRole("region", { name: "Catálogo de ofertas" });
  await expect(catalog.locator("article")).toHaveCount(3);
  await catalog.getByRole("checkbox", { name: "Selecionar Mouse Gamer" }).check();
  await catalog.getByRole("checkbox", { name: "Selecionar Teclado Mecânico" }).check();
  await catalog.getByRole("combobox", { name: "Categoria para selecionadas" }).selectOption("games");
  page.once("dialog", dialog => dialog.accept());
  await catalog.getByRole("button", { name: "Aplicar categoria" }).click();
  await expect.poll(async () => (await storedOffers(page)).filter(x => x.category === "games").length).toBe(2);

  const changed = await storedOffers(page);
  expect(changed.find(x => x.id)?.affiliateProgram).toBe("mercado_livre");
  expect(changed.map(x => x.link).sort()).toEqual([
    "https://meli.la/E2Ecatmouse?tag=af%2Bmouse",
    "https://meli.la/E2Ecatkeyboard?tag=af%2Bkeyboard",
    "https://meli.la/E2Ecatcable?tag=af%2Bcable",
  ].sort());

  await catalog.getByRole("combobox", { name: "Filtrar por categoria" }).selectOption("games");
  await expect(catalog.locator("article")).toHaveCount(2);
  await catalog.getByRole("textbox", { name: "Buscar ofertas" }).fill("TECLADO mecanico");
  await expect(catalog.locator("article")).toHaveCount(1);
  await expect(catalog.getByRole("heading", { name: "Teclado Mecânico" })).toBeVisible();
  await catalog.getByRole("button", { name: "Limpar filtros" }).click();
  await catalog.getByRole("combobox", { name: "Filtrar por programa" }).selectOption("mercado_livre");
  await expect(catalog.locator("article")).toHaveCount(3);
  await catalog.getByRole("button", { name: "Limpar filtros" }).click();
  await catalog.getByRole("combobox", { name: "Ordenar ofertas" }).selectOption("title");
  await expect(catalog.locator("article").first().getByRole("heading", { name: "Cabo USB" })).toBeVisible();
  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
});


test("auditoria local detecta link de produto e duplicação sem consultar rede ou alterar tracking", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const original="https://meli.la/E2Eaudit?tag=original%2Bcampaign";
  const product="https://produto.mercadolivre.com.br/MLB-123456789-fone-_JM?source=teste";
  const data=["Fone Sem Fio",original,"Produto Comum",product].join("\n");
  await page.getByRole("textbox", { name: "Links ou mensagens de compartilhamento" }).fill(data);
  await page.getByRole("button", { name: "Analisar links" }).click();
  await page.getByRole("button", { name: "Selecionar com nome" }).click();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Salvar 2 selecionadas" }).click();
  await expect.poll(async () => (await storedOffers(page)).length).toBe(2);

  const audit=page.getByRole("group", { name: "Auditoria local de links de afiliado" });
  await page.locator('details[aria-label="Auditoria local de links de afiliado"] summary').click();
  await expect(audit.getByText("1 para revisar")).toBeVisible();
  await expect(audit.getByText(/Link comum de produto/)).toBeVisible();

  const catalog=page.getByRole("region", { name: "Catálogo de ofertas" });
  await catalog.getByRole("button", { name: "Duplicar Fone Sem Fio" }).click();
  await expect.poll(async () => (await storedOffers(page)).length).toBe(3);
  await expect(audit.getByText("3 para revisar")).toBeVisible();
  await expect(audit.getByText(/Outra oferta usa exatamente o mesmo link/).first()).toBeVisible();
  const current=await storedOffers(page);
  expect(current.filter(x=>x.link===original)).toHaveLength(2);
  expect(current.find(x=>x.link===product)).toBeDefined();
  const widths=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,screen:window.innerWidth}));
  expect(widths.doc).toBeLessThanOrEqual(widths.screen+1);
});
