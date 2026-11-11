# WhatsApp Affiliate Operator

Ferramenta **privada** para compartilhar **manualmente** texto e links de ofertas em grupos dos quais a conta conectada participa.

**Não é SaaS.** Não possui cobrança, assinaturas, trial, disparos automáticos, programação recorrente ou integração com Instagram.

> O projeto usa Baileys, uma integração não oficial com o WhatsApp Web. Existe risco de restrição ou bloqueio da conta. Pausas e limites de envio não garantem proteção. Use somente em grupos em que seja permitido divulgar ofertas e respeite o regulamento de cada programa de afiliados.

## Execução local

1. Instale Bun e execute **bun install**.
2. Copie **.env.example** para **.env**.
3. Preencha **FIREBASE_PROJECT_ID** com o projeto do arquivo firebase-applet-config.json.
4. Preencha **AUTHORIZED_EMAILS** com o e-mail Google do operador autorizado. Para testes, você pode incluir outros e-mails separados por vírgula. A variável vazia bloqueia todos os acessos (fail closed).
5. No Firebase Authentication, confirme que o provedor Google está ativado e o domínio do aplicativo está autorizado.
6. Rode **bun run dev**, entre com Google e conecte o WhatsApp pelo QR Code.
7. Selecione um grupo e envie uma única oferta de teste manualmente, sempre com permissão.

## Passos de segurança obrigatórios antes de publicar

- **Aplique as novas regras do Firestore.** O arquivo firestore.rules agora nega todas as operações por clientes. O app não usa mais perfis ou assinaturas no Firestore. **O commit sozinho não altera as regras do seu projeto Firebase publicado**; a falha da regra anterior permanece até o deploy. Faça a implantação das regras no projeto e database corretos; se houver múltiplos bancos, confirme explicitamente qual deles recebeu o deploy.
- O backend exige Firebase ID Token válido, e-mail verificado e inclusão em AUTHORIZED_EMAILS (variável de ambiente exclusivamente do servidor).
- Os endpoints de envio aceitam apenas IDs de grupos pertencentes à sessão conectada. Números individuais e disparos em lote foram removidos.
- Os envios são manuais: limite de 10 mensagens por hora e intervalo mínimo de 30 segundos. Esses limites estão **em memória**, não são controles antifraude persistentes e não permitem escalar horizontalmente.
- As credenciais do WhatsApp ficam em WHATSAPP_AUTH_DIR. Mantenha os arquivos fora do Git, com acesso restrito e em disco persistente, preferencialmente cifrado. Em hospedagem com disco efêmero, reiniciar o servidor poderá exigir novo QR.
- **Execute uma instância do serviço por sessão**, sem múltiplas réplicas, pois estado e limitador são locais ao processo.
- A confirmação de envio é a aceitação da chamada à biblioteca; **não comprova entrega**.
- O arquivo firebase-applet-config.json possui identificadores públicos do Firebase. Restrinja o uso da chave e os domínios de autenticação no console, conforme a configuração do seu projeto.
- Não hospede esse projeto publicamente com env de demonstração ou sem a allowlist configurada.

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

A versão anterior tinha acesso por assinatura, painel administrativo, envios em massa para números e bypass de autenticação para ping. Esses fluxos foram removidos do backend e da interface. Ajuste as variáveis de ambiente e atualize as regras do Firestore antes de implantar.

**Aviso de conformidade:** antes de divulgar links do Mercado Livre ou de qualquer plataforma, confirme as regras vigentes do programa e se o grupo é elegível. A automação não deve ser usada para spam ou mensagens não solicitadas.
