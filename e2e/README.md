# E2E do Affiliate Operator (PR #20)

Teste real de **interface no Chromium headless** com Playwright e Vite, sem custo de serviços pagos.

## Alcance real
A fixture \`e2e/fixture.html\` monta os componentes de produção **OfferLibrary**, **MercadoLivreImporter** e **CloudSyncPanel**, navegados por um navegador real. Cobre colagem de links, revisão/salvamento, URLs com tracking, duplicatas, lotes, CSV/TXT, backup de JSON e interações de backup/restauração.

A fixture usa usuário fictício isolado e um **simulador local de armazenamento cloud** para impedir gravações no D1 real. **Não** testa Firebase Auth, login Google, APIs reais do Cloudflare D1, sessão Baileys/WhatsApp nem o Android PWA Share Target nativo. Essas integrações continuam exigindo testes reais do Matheus e/ou contract tests específicos.

**Segurança:** fixture é uma página HTML independente usada só no **Vite dev**; o build de produção do Vite inclui exclusivamente \`index.html\`. Não há bypass de autenticação no \`App.tsx\` ou no backend. Nenhum link de afiliado real deve ser usado nos testes; os links são fictícios e não são abertos.

## Rodar localmente
Requisitos: Bun, Node.js, Chromium Playwright.
\`\`\`bash
bun install
npm install --prefix e2e --no-package-lock --ignore-scripts
./e2e/node_modules/.bin/playwright install chromium
./e2e/node_modules/.bin/playwright test --config=e2e/playwright.config.mjs
\`\`\`
O Playwright inicia o Vite no localhost:4173 automaticamente. Os testes não fazem chamadas a APIs autenticadas.
