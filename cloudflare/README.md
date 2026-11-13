# Cloudflare Scheduler — Affiliate Operator (PR #8)

Este diretório contém uma **base de agendamento persistente** para **Cloudflare Workers Cron + D1**, separada do Render Free. O Worker roda a cada cinco minutos, calcula o dia e a hora em \`America/Sao_Paulo\`, identifica rotinas vencidas e cria uma **ocorrência pendente de revisão** no D1. **Nenhum post é enviado automaticamente**, em nenhum canal.

> Cloudflare **ainda não está conectada à conta do ChatGPT e estes recursos não foram provisionados**. Não há Worker ou D1 ativo até seguir as etapas abaixo.

## Instalação (quando houver acesso à conta Cloudflare)

1. Entre na conta Cloudflare em https://dash.cloudflare.com e verifique o plano Workers Free.
2. Dentro de \`cloudflare/\`, execute \`npx wrangler login\`.
3. Crie um banco: \`npx wrangler d1 create affiliate-operator-db\`.
4. Copie o UUID que o CLI devolver para \`database_id\` em \`cloudflare/wrangler.toml\`. **Não invente o ID**.
5. Execute \`npx wrangler d1 migrations apply affiliate-operator-db --remote\` a partir de \`cloudflare/\`. Confira que só o banco novo foi alterado.
6. Gere um token aleatório e forte, por exemplo, \`openssl rand -hex 32\`. Mantenha-o fora do repositório. Em \`cloudflare/\`, execute \`npx wrangler secret put INTERNAL_API_TOKEN\` e cole o token.
7. Execute \`npx wrangler deploy\`. Anote a URL **real** \`https://<nome>.<conta>.workers.dev\` informada pelo CLI.
8. No **Render**, na instância do Affiliate Operator, crie as variáveis privadas \`CLOUDFLARE_WORKER_URL\` com a URL do Worker e \`CLOUDFLARE_WORKER_TOKEN\` com **o mesmo token** (não publicar em GitHub).
9. Após integração da aplicação no Render, valide \`GET /api/planner/state\` com login Google e e-mail autorizado, então salve um rascunho teste e verifique persistência/recuperação em outro navegador.
10. Inspecione \`GET /api/planner/jobs\` após uma ocorrência de teste programada. **Não é uma publicação**; status inicial \`pending_review\`.

## Segurança e limites

- API interna exige \`Authorization: Bearer <token aleatório de >=32 caracteres>\` e \`x-operator-uid\`. Esses cabeçalhos **são adicionados pelo backend Express**, após validar o Firebase ID Token e \`AUTHORIZED_EMAILS\`; nunca exponha o token no frontend.
- APIs D1 possuem escopo por UID, sem ler rotinas de outro usuário.
- \`PUT /internal/state\` faz substituição completa e transacional das ofertas e rotinas de **um UID**. **A versão inicial é last-write-wins**, portanto sincronização entre múltiplas abas concorrentes pode sobrescrever mudanças; use uma sessão por vez até implementarmos controle de conflitos.
- Ao excluir uma rotina ou oferta, a agenda ativa deixa de gerar novos eventos. O histórico de ocorrências passadas fica preservado para auditoria.
- Os trabalhos são **somente \`pending_review\`**, nunca invocam Baileys ou Instagram. Não há entrega automática nem garantia de minuto exato. Reexecuções do Cron não duplicam uma mesma rotina/dia graças à chave primária no D1.
- O Cron usa \`*/5 * * * *\`, que é interpretado pela Cloudflare em **UTC**. O Worker decide a elegibilidade segundo o relógio local de São Paulo. Uma parada pode atrasar ocorrências do mesmo dia; não há publicação retroativa automática.
- A seleção de rotinas ativas tem limite inicial de **500** por execução. Essa versão é para **um operador** e até 100 regras por usuário; é necessário paginar antes de ampliar.
- O Render pode dormir sem prejudicar a criação das ocorrências no D1, mas o **WhatsApp via Baileys não fica conectado**. Se o plano for publicar sem intervenção, teremos que adicionar um conector de canal permitido e um despachante auditável.
- Monitorar os limites gratuitos do Cloudflare D1 e Workers; esgotar cotas fará consultas falharem, mesmo que o Render esteja ativo.
- Nenhuma variável \`CLOUDFLARE_*\` é obrigatória para o site atual. Sem elas, o proxy responde **503** e a biblioteca local atual continua funcionando.

## API de serviço

Backend Render → Worker (token somente no servidor):
- \`GET /internal/state\`: retorna \`{ offers, rules, revision }\`
- \`PUT /internal/state\`: substitui estado validado do operador (até 100 ofertas/100 rotinas; payload 200 KB)
- \`GET /internal/jobs\`: retorna últimas 100 ocorrências
- \`POST /internal/jobs/mark\`: marca manualmente uma ocorrência como concluída ou ignorada

O cron Worker cria ocorrências em D1; a interface de sincronização e migração do armazenamento local será incluída após provisionamento de D1 e configuração dos segredos, para evitar perda de dados existentes.
