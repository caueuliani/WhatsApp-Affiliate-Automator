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
