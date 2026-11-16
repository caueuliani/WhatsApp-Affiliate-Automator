## Candidate de integração — #21 + #22 + #23 (somente teste)

Esta branch prévia combina **snapshots de código** dos PRs 21, 22 e 23 para validar integração antes de qualquer publicação. **NÃO é a main, não há deploy e nenhum dado de produção é consultado ou escrito.** As alterações de README são combinadas preservando a documentação das duas branches. Quando o Matheus liberar, os PRs originais devem ser integrados sequencialmente e validados novamente; não usar a candidate para publicar diretamente.

## PR #21 — Backup automático seguro (NÃO PUBLICADO)

A implementação existe somente numa branch/PR separado, desativada por padrão. O operador precisa primeiro confirmar explicitamente que biblioteca e agenda locais correspondem à última revisão do Cloudflare D1. Se forem diferentes, precisa usar os botões manuais existentes para enviar ou restaurar dados antes de ativar.

Após habilitação, a cada 30 segundos ou retomada de foco: (1) lê a biblioteca local, (2) compara sua assinatura SHA-256 e a revisão do D1 à base conhecida, e (3) **envia mudanças locais apenas se a nuvem não mudou**, usando controle transacional de versão (expectedRevision). Mudanças remotas são detectadas, mas nunca restauradas automaticamente: o modo pausa para revisão, evitando descartar formulários não salvos. Divergências simultâneas, bibliotecas esvaziadas, regras inválidas e conflitos CAS também interrompem uploads; falhas de rede preservam dados locais.

**Limite consciente:** backup automático local → D1 e detecção de atualização remota, **não** sincronização bidirecional total. Não altera banco D1, migrações, Worker, secrets ou WhatsApp. Testes automatizados cobrem conflitos, preservação de links, opt-in e falhas.

**Publicação explicitamente suspensa.** Não mesclar em main, não disparar Render/Cloudflare e não testar escrevendo na conta do Matheus até nova autorização. Antes de futura implantação, exportar backup e verificar que Matheus não esteja editando.

## Browser E2E no Chromium — PR #20

O workflow **CI** também executa o job **Chromium UI E2E (isolated fixture)** com Playwright no GitHub Actions. Testes exercitam os componentes reais da biblioteca, importador e tela de backup em um navegador real (link individual, parâmetros de afiliado, duplicatas, lotes, CSV, rejeição de domínio falso, restauração e layout mobile). Não há dependência de serviços pagos.

Os testes iniciam um servidor Vite local com a fixture \`e2e/fixture.html\`. Ela usa um **UID fictício** e armazenamento local para simular a API do D1; não tem acesso ao Firebase, conta do Matheus, WhatsApp ou Cloudflare real. A fixture não é publicada com o \`vite build\` (somente \`index.html\` vai ao \`dist\`). Os testes **não substituem** a homologação Android, autenticação Google, WhatsApp/QR, D1 real ou autorização de comissão.

Para executar localmente, veja \`e2e/README.md\`. Se o job falhar, o GitHub Actions salva screenshot/trace por 7 dias para diagnóstico.

## To Do do Matheus — homologação mobile-first (PR #19)

Na **Visão geral**, o card **To Do do Matheus** apresenta 45 testes organizados por prioridade: P0 (Mercado Livre básico e importação em lote), P1 (PWA Android, Cloudflare D1 e WhatsApp), P2 (responsividade e validação de segurança). Cada teste tem objetivo/resultado esperado e status \`Pendente / OK / Falhou / Bloqueado\`. O progresso fica no \`localStorage\` por conta Google e aparelho, **não sincroniza automaticamente** com D1; nenhum dado de afiliado é exportado ao copiar/baixar o relatório.

**Checklist completo no GitHub:** https://github.com/caueuliani/WhatsApp-Affiliate-Automator/issues/17

O relatório exportado inclui apenas os identificadores e títulos dos testes, estados e totais. Nunca cole QR, número pessoal, códigos WhatsApp, tokens ou links rastreados em issues públicas. O botão **Zerar status** só limpa o checklist local, não as ofertas ou agenda.


## PR #23 — Auditoria local de links (DRAFT empilhado sobre #22)

O card expansível **Ofertas → Auditoria dos links** mostra quantas URLs precisam de revisão, sem realizar chamadas HTTP ou seguir redirecionamentos. A auditoria sinaliza link vazio, HTTP/URL insegura, domínio não reconhecido como Mercado Livre, link comum de produto e URLs **literalmente idênticas** cadastradas mais de uma vez. URLs com mesmo identificador de produto mas diferentes parâmetros são indicadas como possível mesmo produto, **não** mescladas nem regravadas. A análise é somente heurística local de formato/domínio; não confirma acesso à Central, atribuição de comissão, preço, status de campanha ou disponibilidade.

Há botões separados para revisão manual no editor e **copiar exatamente o link original**, sem editar parâmetros. O resumo para reporte **não inclui URLs, títulos ou etiquetas de rastreamento**. Nenhum resultado é persistido fora do estado da interface, nenhuma consulta externa é feita e nenhuma oferta é publicada.

**Dependência e ordem de merge quando autorizado:** #22 deve ser integrado primeiro; então atualizar base do #23 para main e verificar CI. #21, #22 e #23 continuam sem merge/deploy até a autorização do usuário e janela livre do Matheus. Fazer backup local antes da publicação.

## PR #22 — catálogo avançado (DRAFT, NÃO PUBLICAR)

Organização manual das ofertas na aba **Ofertas → Catálogo de ofertas**:
- Categorias **Tecnologia**, **Games**, **Casa e cozinha**, **Moda**, **Beleza**, **Esportes** e **Outros**; novas ofertas/importações iniciam em "Outros", sem inferir informações do anúncio.
- Busca por nome, descrição, etiqueta de campanha ou URL, sem diferenciar acentos/maiúsculas.
- Filtros por **categoria**, **programa de afiliados**, **revisão vencida/futura/sem data** e ordenação por revisão, atualização, nome e preço informado (sem preço fica no final).
- Marcação de ofertas visíveis e categorização manual em lote com confirmação; **não exclui**, publica ou modifica links/etiquetas de rastreamento. Seleções fora dos filtros não são modificadas.
- Metadado opcional \`category\` no formato atual de oferta/backup v1; backups antigos sem categoria continuam válidos e são exibidos como "Outros". O D1 já armazena o JSON completo da oferta, então não há migração nova.
- Testes unitários para filtros e integridade de tracking/backup e cenário Playwright no viewport 375px.

**Publicação suspensa:** PR #21 e PR #22 não podem ser mesclados ou publicados enquanto o Matheus estiver trabalhando, sem autorização explícita para retomada. É necessário combinar uma janela e exportar backup antes de habilitar funcionalidades novas.

## Browser E2E no Chromium — PR #20

O workflow **CI** também executa o job **Chromium UI E2E (isolated fixture)** com Playwright no GitHub Actions. Testes exercitam os componentes reais da biblioteca, importador e tela de backup em um navegador real (link individual, parâmetros de afiliado, duplicatas, lotes, CSV, rejeição de domínio falso, restauração e layout mobile). Não há dependência de serviços pagos.

Os testes iniciam um servidor Vite local com a fixture \`e2e/fixture.html\`. Ela usa um **UID fictício** e armazenamento local para simular a API do D1; não tem acesso ao Firebase, conta do Matheus, WhatsApp ou Cloudflare real. A fixture não é publicada com o \`vite build\` (somente \`index.html\` vai ao \`dist\`). Os testes **não substituem** a homologação Android, autenticação Google, WhatsApp/QR, D1 real ou autorização de comissão.

Para executar localmente, veja \`e2e/README.md\`. Se o job falhar, o GitHub Actions salva screenshot/trace por 7 dias para diagnóstico.

## To Do do Matheus — homologação mobile-first (PR #19)

Na **Visão geral**, o card **To Do do Matheus** apresenta 45 testes organizados por prioridade: P0 (Mercado Livre básico e importação em lote), P1 (PWA Android, Cloudflare D1 e WhatsApp), P2 (responsividade e validação de segurança). Cada teste tem objetivo/resultado esperado e status \`Pendente / OK / Falhou / Bloqueado\`. O progresso fica no \`localStorage\` por conta Google e aparelho, **não sincroniza automaticamente** com D1; nenhum dado de afiliado é exportado ao copiar/baixar o relatório.

**Checklist completo no GitHub:** https://github.com/caueuliani/WhatsApp-Affiliate-Automator/issues/17

O relatório exportado inclui apenas os identificadores e títulos dos testes, estados e totais. Nunca cole QR, número pessoal, códigos WhatsApp, tokens ou links rastreados em issues públicas. O botão **Zerar status** só limpa o checklist local, não as ofertas ou agenda.

## Mercado Livre: importar arquivos CSV/TXT preparados pelo usuário (PR #18)

Em **Ofertas → Importar links → Selecionar arquivo**, o operador pode escolher arquivos locais \`.csv\` ou \`.txt\` com até 12 mil caracteres e até 20 links por importação. \`TXT\` aceita a mesma colagem de URLs/mensagens; \`CSV\` aceita colunas \`produto;link\` (também vírgula e alguns nomes de coluna equivalentes). Acesse **Baixar modelo CSV** na própria interface. O parser roda localmente, não envia o arquivo ao servidor. Links fora dos domínios Mercado Livre são rejeitados, duplicatas do arquivo são agrupadas, e o operador revisa nome/seleção antes de salvar. Nenhum preço do arquivo é tratado como verificado; links originais e parâmetros de comissão são mantidos.

**Importante:** o modelo CSV é um formato do Affiliate Operator, não um formato de exportação oficial do Mercado Livre. Não existe integração automática à Central nem validação independente de comissão/preço. Salvar em lote só altera a biblioteca local, mediante confirmação; o backup no Cloudflare D1 continua manual.

## Mercado Livre — revisão e salvamento em lote (PR #16)

Em **Ofertas → Importar links da Central de Afiliados**, o operador pode analisar até 20 links em uma mensagem, conferir/editar os nomes, selecionar os que deseja e tocar em **Salvar selecionadas**. A função salva todas as ofertas aprovadas numa única operação local, sem modificar a URL original do afiliado. Nomes não identificados pelo texto de compartilhamento exigem preenchimento manual, links já salvos são desabilitados e o limite global da biblioteca continua 100. A importação não consulta preços, descontos, disponibilidade nem comissões, não acessa a conta do Mercado Livre e não dispara publicações. Depois de importar, use o backup D1 manual na mesma tela para transferir dados entre dispositivos.


## Concorrência no D1 — Compare-and-swap (PR #15)

O upload agora exige \`expectedRevision\`, um inteiro não negativo correspondente à revisão lida pelo cliente. O Worker tenta obter a revisão dentro de um único \`D1.batch()\` transacional; cada instrução que apaga ou insere ofertas e rotinas depende de um token único de posse da mesma operação. Caso a revisão esteja desatualizada, **nenhuma oferta ou rotina é alterada** e a API retorna HTTP \`409\` com \`currentRevision\`, em vez de sobrescrever os dados de outro aparelho. A migration \`0002_revision_write_token.sql\` adiciona apenas uma coluna à tabela \`operator_revisions\` e preserva revisões e backups anteriores.

**Ordem de implantação obrigatória (evita quebra):**
1. Executar o workflow manual **Cloudflare Scheduler (manual deploy)** na branch main com confirmação \`DEPLOY\`, que aplica migration 0002 antes de implantar o novo Worker.
2. Confirmar workflow verde.
3. Implantar a nova main no Render; até então a versão Render antiga pode usar o Worker novo apenas com uploads antigos, que serão recusados com 428 (sem apagar nada).
4. Testar backup e conflito entre dois navegadores, verificar que os dados anteriores permanecem intactos.

Não ativar sincronização automática nem executar gravação de teste com dados de produção sem backup.

## PWA Android: Compartilhar do Mercado Livre (PR #13)

Instale o Affiliate Operator no Android usando Chrome (**Instalar app** / **Adicionar à tela inicial**). Depois, gere seu link de afiliado na Barra de Afiliados ou Central do Mercado Livre, toque **Compartilhar** e escolha o Affiliate Operator. A aba **Ofertas** abrirá com os links encontrados, que precisam de revisão individual. O recurso depende do Android/Chromium e deve ser testado no telefone real.

Privacidade: o service worker intercepta o POST \`/share-target\` sem enviar conteúdo ao servidor, grava o texto de compartilhamento (máximo 12 KB) em IndexedDB local, consome uma vez após autenticação Firebase e autorização da allowlist, e ignora dados depois de 10 minutos. A URL de afiliado não entra na query string. O service worker não armazena tokens, não faz cache de APIs privadas e não publica automaticamente. Se o navegador não suportar Web Share Target, o importador por colagem continua funcionando.

## Backup D1 entre celular e PC (PR #12)

Na aba **Ofertas → Backup entre celular e computador**, o operador autorizado pode consultar a revisão salva na Cloudflare e, após confirmação explícita:
- **Enviar para a nuvem:** envia a biblioteca de ofertas e as rotinas semanais do navegador atual para o D1. O estado remoto anterior é **substituído**; o aplicativo alerta quantidades, lê a revisão novamente antes da gravação e bloqueia upload vazio.
- **Restaurar da nuvem:** traz ofertas e rotinas do D1, cria um backup recuperável no armazenamento local e recarrega o app. A opção **Desfazer última restauração** restaura a versão local anterior.
- **Atualizar estado:** consulta o D1 sem alterar dados.

O backend já verifica Firebase Authentication e allowlist antes de repassar dados ao Worker usando \`CLOUDFLARE_WORKER_URL\` e \`CLOUDFLARE_WORKER_TOKEN\`. Nenhum token sensível é enviado ao navegador. Esta é **transferência manual assistida, não sincronização automática em tempo real**. O Worker atualmente aplica atualizações como \`last-write-wins\`: ainda existe risco de gravações concorrentes, mesmo com a segunda leitura preventiva. Não usar dois dispositivos para editar o mesmo conjunto de dados ao mesmo tempo até adotarmos controle transacional de revisão. O Cron registra apenas revisões pendentes, nunca publica no WhatsApp.

## Mercado Livre: importação assistida de links (PR #11)

A aba **Ofertas** inclui um importador mobile-first para links gerados na Central de Afiliados / Barra de Afiliados. Ele aceita texto de compartilhamento, links \`https://meli.la/...\`, \`https://mercadolivre.com/sec/...\` e URLs oficiais de produtos, inclusive **lotes de até 20 URLs**. O botão **Colar do celular** usa a permissão nativa da área de transferência (se disponível); também é possível colar manualmente.

O sistema reconhece o domínio, sugere um título quando houver texto/slug legível, marca links já cadastrados e oferece **Revisar e salvar** (cada item individualmente). Após revisão, a oferta entra na biblioteca existente, preservando a URL original **com todos os parâmetros**. Não existe conversão automática de link comum em link de afiliado, consulta de conta, scraping, captura de cookies, redirecionamento automático, nem alegação de que uma URL gera comissão.

**Limitações atuais:** não é uma integração de importação automática da própria Central de Afiliados. Preço e desconto não são consultados/verificados; nunca são preenchidos automaticamente. O operador precisa confirmar dados e comissão no Mercado Livre. Os dados permanecem no \`localStorage\` do navegador até a futura migração/sincronização ao D1, disponível no backend. Mantenha backup entre dispositivos. Publicação é manual e deve respeitar as regras do programa e do canal.

# WhatsApp Affiliate Operator

Ferramenta **privada** para gerenciar ofertas e compartilhar **manualmente** texto e links de afiliados em grupos dos quais a conta conectada participa.

## Mobile-first + conexão WhatsApp no mesmo telefone (PR #10)

O celular é a experiência principal: navegação **fixa na parte inferior** com cinco seções, áreas de toque de pelo menos 44px, formulário de 16px para não causar zoom inesperado, layouts adaptados para telas estreitas e respeito à safe-area dos aparelhos. Desktop continua com menu lateral.

Na aba **Conexão**, o operador pode optar por **Mesmo celular** (padrão) ou **Outro aparelho** (QR Code).
- No modo Mesmo celular, digite o telefone com código do país e DDD, somente números (ex.: `5511999999999`, exemplo fictício).
- O backend autenticado solicita um **código temporário de oito caracteres** via `requestPairingCode` do Baileys, com intervalo mínimo de 60 segundos entre solicitações por operador.
- Volte ao WhatsApp no próprio celular → Aparelhos conectados → Conectar aparelho → Conectar com número de telefone e informe o código. A tela do Affiliate Operator detectará o vínculo quando a sessão abrir.
- O telefone e o código **não são persistidos** e não entram nos logs. Nunca publique QR Codes, códigos ou tokens.
- O método é **não oficial** e pode falhar conforme alterações do WhatsApp. Não resolve a perda de sessão local no Render Free, nem autoriza disparos automáticos.
- O backend permanece protegido por Firebase Authentication e allowlist; não há nova variável de ambiente.

## Motor persistente Cloudflare (PR #8)

A base independente de agendamento está em [cloudflare/README.md](cloudflare/README.md). Inclui schema D1, Worker Cron a cada cinco minutos e fila auditável com prevenção de duplicatas. **Nenhum envio é automático**: o motor cria ocorrências para revisão; integração oficial de publicação será implementada depois. Isso permite que a agenda produza eventos de horário sem depender de alguém abrir o painel Render.

O backend Express oferece endpoints autenticados \`/api/planner/status\`, \`/api/planner/state\`, \`/api/planner/jobs\` e \`/api/planner/jobs/mark\`. Eles ficam desativados (503) enquanto \`CLOUDFLARE_WORKER_URL\` e \`CLOUDFLARE_WORKER_TOKEN\` não forem configurados no Render. O token privado nunca sai do servidor; Firebase Auth continua obrigatório. A interface ainda usa os rascunhos locais, aguardando migração protegida quando o D1 estiver provisionado.

## Agenda semanal e etiquetas de afiliado (PR #7)

- Cadastre uma oferta com o **link HTTPS gerado pelo programa de afiliados**, escolha o programa (Mercado Livre, Shopee, Amazon ou Outro) e, se quiser, uma **etiqueta interna** da campanha. A ferramenta **nunca modifica o URL rastreado**. Caso o Mercado Livre ofereça etiquetas de rastreamento, gere o link etiquetado no painel oficial e cole o link resultante no cadastro.
- Abra **Agenda** e associe uma oferta a uma rotina recorrente, escolhendo dias da semana (0 a 6), horário em **America/Sao_Paulo**, canal (WhatsApp ou Instagram) e nome do destino. Uma mesma oferta pode ter várias rotinas e várias ofertas podem alternar entre dias.
- A agenda exibe as próximas **duas semanas**. Para WhatsApp, o botão **Preparar envio** abre o formulário manual. Para Instagram, **Copiar legenda** prepara o texto — **não conecta uma conta e não publica**.
- Os horários são referências visuais, sem serviço cron, fila, servidor persistente ou garantia de postagem pontual. No Render Free, o serviço suspende após inatividade. Nenhum envio automático foi ativado.
- As rotinas ficam no `localStorage` por UID, independentemente da biblioteca de ofertas, e precisam de backup próprio (botões **Exportar agenda** / **Importar agenda**). Importar uma agenda requer que as ofertas referenciadas já existam neste navegador.
- Para a integração futura com Instagram, será necessária uma **conta profissional**, uma aplicação Meta, permissões de publicação e arquivos de imagem/vídeo hospedados e acessíveis. Não armazenar tokens da Meta no navegador nem no GitHub.
- Não habilite publicação automática no WhatsApp sem verificar a elegibilidade dos grupos, o consentimento dos membros e os termos do WhatsApp e do programa de afiliados. A biblioteca não valida a elegibilidade desses canais.

## Painel de operação (PR #6)

A interface é dividida em **Visão geral, Ofertas, Agenda, Publicar e Conexão**, com navegação responsiva para desktop e celular. O resumo mostra apenas os dados locais da biblioteca (total de ofertas, revisões vencidas e futuras). Ele **não contabiliza envios nem promete integração de agendamento real**.

O QR Code permanece acessível em **Conexão**. O painel não altera a API de WhatsApp nem a política de sessão. **Durante testes com QR Code ativo, não realize deploy no Render Free**: o reinício pode interromper a sessão e forçar uma nova leitura.

## Biblioteca de ofertas (fase 1)

O operador pode cadastrar, editar, duplicar, excluir, buscar, filtrar e preparar rascunhos com título, mensagem, link HTTPS, preço de referência e horário planejado de revisão. Uma oferta salva pode preencher o formulário de envio; o envio exige confirmação explícita de permissão para divulgar naquele grupo. **Datas são lembretes visuais, não programações de envio automático**.

As ofertas são armazenadas via **localStorage**, separadas pelo UID da conta no mesmo navegador. Elas **não sincronizam entre aparelhos** e podem desaparecer se o navegador limpar os dados. Há botões para **exportar e importar backups JSON**. O backup contém textos e links de afiliados, portanto mantenha-o em local protegido. Limite atual: 100 ofertas por navegador/operador.


**Não é SaaS.** Não possui cobrança, assinaturas, trial, disparos automáticos ou integração ativa com Instagram. Possui **planejamento semanal recorrente, mas não executa envios automáticos**.

> O projeto usa Baileys, uma integração não oficial com o WhatsApp Web. Existe risco de restrição ou bloqueio da conta. Pausas e limites de envio não garantem proteção. Use somente em grupos em que seja permitido divulgar ofertas e respeite o regulamento de cada programa de afiliados.

## Diagnóstico de login Google no Render

No frontend, **um erro durante o popup Google** é diferente do erro `403` do backend. O app agora apresenta o código público `auth/...` retornado pelo SDK e instruções específicas; não presume que toda falha seja causada pelo domínio.

Se o Google Sign-In falhar:
1. No [Firebase Console do projeto affiliate-operator](https://console.firebase.google.com/project/affiliate-operator/authentication), acesse **Authentication → Sign-in method** e confirme o provedor **Google** ativado.
2. Em **Authentication → Settings/Configurações → Authorized domains/Domínios autorizados**, adicione **exatamente** `affiliate-operator-devtecs-nrla.onrender.com` (somente o hostname, sem `https://`, sem barra e sem curinga `*`).
3. Abra novamente `https://affiliate-operator-devtecs-nrla.onrender.com` e tente entrar. Se falhar, anote o **código** exibido pela aplicação. `auth/unauthorized-domain` significa falta de autorização de domínio; `auth/operation-not-allowed` indica provedor desativado; `auth/popup-blocked` indica bloqueio da janela.
4. **Após** o login Google funcionar, se aparecer "Sua conta não está autorizada", configure `AUTHORIZED_EMAILS` no servidor Render com o e-mail exato do operador. Essa variável é **uma autorização no nosso backend**, distinta dos domínios autorizados no Firebase.
5. Não coloque e-mails, tokens de autenticação, chaves privadas ou QR Codes em issues públicas ou logs.

O Firebase Admin do backend verifica os ID Tokens do projeto `affiliate-operator`. O login não exige banco Firestore ou Firebase Hosting.

## Execução local

1. Instale Bun e execute **bun install**.
2. Copie **.env.example** para **.env**.
3. O app Web já aponta para o projeto Firebase **affiliate-operator**. Configure **FIREBASE_PROJECT_ID=affiliate-operator** no servidor (opcional em desenvolvimento, pois há fallback para o ID do app Web). Um ID divergente impede a inicialização para evitar validar tokens do projeto errado.
4. Preencha **AUTHORIZED_EMAILS** com o e-mail Google do operador autorizado. Para testes, você pode incluir outros e-mails separados por vírgula. A variável vazia bloqueia todos os acessos (fail closed). Não é necessário informar o e-mail no GitHub nem colocá-lo no frontend.
5. No [Firebase Console](https://console.firebase.google.com/project/affiliate-operator/authentication), abra Authentication → Sign-in method → Google e ative o provedor. Em Settings → Authorized domains, autorize somente os domínios efetivamente usados (e localhost para testes, se necessário).
6. Rode **bun run dev**, entre com Google e conecte o WhatsApp pelo QR Code.
7. Selecione um grupo e envie uma única oferta de teste manualmente, sempre com permissão.

## Passos de segurança obrigatórios antes de publicar

- **Não é necessário criar Firestore no projeto affiliate-operator.** A aplicação atual usa somente Firebase Authentication. O arquivo firestore.rules permanece como registro da regra restritiva do protótipo anterior e **não deve ser publicado no Astra Brain sem identificar e avaliar o banco correto**. O banco legado no projeto Astra Brain deve ser auditado e protegido separadamente; este PR não altera suas regras no console.
- O backend exige Firebase ID Token válido, e-mail verificado e inclusão em AUTHORIZED_EMAILS (variável de ambiente exclusivamente do servidor).
- Os endpoints de envio aceitam apenas IDs de grupos pertencentes à sessão conectada. Números individuais e disparos em lote foram removidos.
- Os envios são manuais: limite de 10 mensagens por hora e intervalo mínimo de 30 segundos. Esses limites estão **em memória**, não são controles antifraude persistentes e não permitem escalar horizontalmente.
- As credenciais do WhatsApp ficam em WHATSAPP_AUTH_DIR. Mantenha os arquivos fora do Git, com acesso restrito e em disco persistente, preferencialmente cifrado. Em hospedagem com disco efêmero, reiniciar o servidor poderá exigir novo QR.
- **Execute uma instância do serviço por sessão**, sem múltiplas réplicas, pois estado e limitador são locais ao processo.
- A confirmação de envio é a aceitação da chamada à biblioteca; **não comprova entrega**.
- O arquivo firebase-applet-config.json contém configuração pública da aplicação Web Firebase. Restrinja o uso da chave e os domínios de autenticação no console, conforme a configuração do seu projeto.
- Não hospede esse projeto publicamente com env de demonstração ou sem a allowlist configurada.


## Deploy de teste no Render (frontend + API)

### Arquitetura

Este projeto **não precisa de Firebase Hosting**: o Express serve o React compilado em `dist/` e as rotas `/api/*` no **mesmo Web Service** do Render. O Firebase **affiliate-operator** fica somente com o Authentication (login Google). Não crie Firestore novo, nem faça deploy no Astra Brain.

### Criar o serviço pelo Blueprint

1. Depois de integrar a PR de deploy na `main`, abra o [Render Dashboard](https://dashboard.render.com/) → **New → Blueprint**, conecte o repositório `caueuliani/WhatsApp-Affiliate-Automator` e use o arquivo `render.yaml` da raiz.
2. Revise os recursos: **um Web Service, plano Free**. Não selecione plano pago e não adicione bancos/discos.
3. Preencha `AUTHORIZED_EMAILS` quando o Render solicitar: **e-mail Google real do operador**, já verificado e com acesso autorizado. Para autorizar duas contas, separe os e-mails com vírgula. **Não grave esse e-mail no código ou no GitHub**.
4. Confirme o Blueprint e inicie o primeiro deploy. O processo compila React + Express e inicia o servidor Node usando o `PORT` fornecido pelo Render; não defina `PORT` manualmente.
5. Copie a **URL HTTPS exata** do Web Service criada pelo Render (ex.: `https://affiliate-operator-devtecs.onrender.com`, que é apenas um exemplo e pode ganhar sufixo).
6. No [Firebase Authentication](https://console.firebase.google.com/project/affiliate-operator/authentication), ative Google em **Sign-in method** e adicione **somente o hostname** do Render (sem `https://` e sem `/`) em **Settings → Authorized domains**. Se testar localmente, autorize `localhost`, se ainda não estiver listado.
7. Acesse a URL do Render, entre com uma conta Google incluída em `AUTHORIZED_EMAILS` e teste QR Code, listagem de grupos e um envio manual em um grupo que permita divulgação. Verifique primeiro `/api/health` (deve responder `{"ok":true}`).

**Importante:** `autoDeployTrigger: off` no `render.yaml` evita reinícios a cada push. Para atualizar depois de um merge, execute **Manual Deploy → Deploy latest commit** no serviço Render. O Render não é criado pelo merge no GitHub: o Blueprint precisa ser aprovado no Dashboard.

### Limitações reais do Render Free

- O serviço **suspende depois de 15 minutos sem tráfego de entrada**. Enquanto suspenso, a conexão WhatsApp está desligada e a aplicação não processa tarefas.
- O sistema usa **Baileys**, integração não oficial, e mantém autenticação do WhatsApp em arquivos locais (`WHATSAPP_AUTH_DIR`). O disco do Render Free é efêmero: reinícios, redeploys e suspensões **apagam a sessão**. Será necessário conectar novamente via QR Code; não considere esse ambiente seguro para publicação automática ou disponibilidade contínua.
- Evite estratégias de *keep-alive* para simular funcionamento 24/7. Elas não resolvem o armazenamento efêmero nem os riscos da conexão não oficial.
- O limite de 10 envios/hora e o estado do servidor também são **apenas em memória**. Render Free é **um protótipo de uso assistido**, não produção para seu amigo.
- As 750 horas gratuitas do workspace são compartilhadas com os demais Free Web Services; acompanhe o consumo no painel e confirme que não há recursos pagos selecionados.
- Para trabalhar com agendamentos confiáveis, primeiro será preciso avaliar **persistência segura de sessão, fila de tarefas, execução contínua** e políticas das plataformas.

### Caso opte pela criação manual (sem Blueprint)

Crie **New → Web Service**, selecione o repositório e branch `main`, runtime Node, plano Free, **Build Command** `bun install && bun run build`, **Start Command** `bun run start`, **Health Check Path** `/api/health`. Cadastre `NODE_ENV=production`, `FIREBASE_PROJECT_ID=affiliate-operator`, `AUTHORIZED_EMAILS` com o operador e `WHATSAPP_AUTH_DIR=./.wa-auth`. Desative **Auto-Deploy** por enquanto. Complete os mesmos passos no Firebase Authentication.

## Verificações

- **bun run lint** — verificação TypeScript
- **bun run test** — testes de regras de validação e limite
- **bun run build** — build Vite e servidor Node
- O workflow .github/workflows/ci.yml executa verificações em push e pull requests.

## Roadmap

1. Validar um ciclo real de login autorizado, QR, listagem de grupos e envio único em grupo permitido.
2. Implementar armazenamento persistente e auditável de ofertas e histórico, com prevenção de duplicatas entre reinícios.
3. Construir cadastro de ofertas, rascunhos e calendário de revisão. Publicação automatizada apenas por meios que as políticas e APIs das plataformas autorizem.
4. Avaliar Instagram profissional pela API oficial da Meta depois que o operador confirmar esse requisito.

## Migração

A versão anterior tinha acesso por assinatura, painel administrativo, envios em massa para números e bypass de autenticação para ping. Esses fluxos foram removidos do backend e da interface. A configuração Web e a validação de tokens agora utilizam o projeto **affiliate-operator**. Os usuários da autenticação antiga não são migrados automaticamente: o operador entrará novamente com Google no novo projeto. O banco Firestore legado continua no projeto Astra Brain e precisa ser tratado separadamente, sem interferir nos demais serviços. Não execute deploy de regras Firestore apontando inadvertidamente para outro projeto.

**Aviso de conformidade:** antes de divulgar links do Mercado Livre ou de qualquer plataforma, confirme as regras vigentes do programa e se o grupo é elegível. A automação não deve ser usada para spam ou mensagens não solicitadas.
