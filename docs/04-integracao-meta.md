# 04 — Integração com Meta / Instagram

## 🔑 Passo a passo: onde pegar cada credencial

Cole cada credencial direto no dashboard, em **Configurações** (`/settings`)
— elas ficam guardadas no banco de dados do próprio app, não em arquivo
nenhum. Caminhos exatos, na ordem:

### 1. Converter a conta e vincular a Página

1. No app do Instagram (celular): **Configurações → Conta → Mudar para conta
   profissional** → escolha **Business**.
2. Ainda nas configurações: **Contas conectadas** (ou **Central de Contas**)
   → conecte a uma **Página do Facebook** (crie uma página nova se não tiver).

### 2. Criar o app → campos **App ID** e **App Secret** em Configurações

1. Acesse **developers.facebook.com/apps** → **Criar app**.
2. Tipo de app: **Business** (ou "Other" → "Business" na tela seguinte).
3. Dê um nome, informe seu e-mail de contato, vincule seu Business
   Portfolio (crie um em business.facebook.com se ainda não tiver).
4. Dentro do app criado: menu lateral **Configurações do app → Básico**.
   - **App ID** aparece no topo dessa página → cole no campo **App ID**
   - **Chave secreta do app** está no mesmo lugar, atrás do botão
     **Mostrar** (pede sua senha do Facebook de novo) → cole no campo
     **App Secret**

### 3. Adicionar o produto Instagram

1. No menu lateral do app: **Adicionar produto** → localize **Instagram**
   → **Configurar**.
2. Isso abre o fluxo **"Instagram API setup"**, com passos numerados na
   própria tela da Meta (conectar a conta Instagram Business, gerar token,
   configurar webhooks) — siga por ele, os IDs abaixo aparecem nesse fluxo.

### 4. Gerar o **Page Access Token** (é este valor que vai no app)

O DMFlow precisa do token da **Página do Facebook vinculada ao Instagram**.
Não cole aqui o App Secret, um token de usuário comum ou o token de teste do
Instagram. O token correto aparece na resposta de `/me/accounts` como
`access_token` da Página.

#### Teste rápido (Development)

O token gerado diretamente no Graph API Explorer é adequado para teste e
normalmente expira. Ele pode validar a conexão, mas não deve ser tratado como
credencial permanente de produção.

1. Abra o [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
   e, no seletor no canto superior direito, escolha **o seu app** (não
   “Graph API Explorer” genérico).
2. Clique **Generate Access Token / Gerar token** → **User Token** e autorize
   as permissões solicitadas para a Página e para mensagens/comentários
   (`pages_show_list`, `pages_read_engagement`, `instagram_basic`,
   `instagram_manage_comments` e
   `instagram_manage_messages`). Em modo Development, sua conta precisa estar
   como administradora/testadora do app.
3. No campo de requisição, selecione **GET** e execute:
   ` /me/accounts?fields=id,name,access_token,instagram_business_account `
4. Localize a Página que está vinculada ao seu Instagram. Copie **somente o
   valor de `access_token` dentro desse objeto de Página** (não copie o token
   do topo nem o `instagram_business_account.id`). Esse é o **Page Access
   Token**.
5. Cole o valor inteiro em **Configurações → Token de acesso da página** no
   DMFlow e salve. O app valida o token contra a Graph API antes de gravá-lo;
   depois ele fica cifrado no banco de dados.

Para conferir antes de salvar, execute no Explorer (substituindo os valores):
`GET /SEU_IG_USER_ID?fields=id,username&access_token=SEU_PAGE_ACCESS_TOKEN`.
Uma resposta JSON com `id` e `username` confirma que o token pertence à conta
certa. Se aparecer **Invalid OAuth access token (code 190)**, gere outro token,
confirme que escolheu a Página correta e que o Instagram é Business/Creator.

#### Produção

Para produção, gere primeiro um **User Access Token de longa duração** pelo
fluxo de Login da Meta do seu app (ou estenda o token de teste pelo
[Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/)
quando a Meta oferecer essa opção). Em seguida, repita `/me/accounts` usando
esse User Token e copie o `access_token` da Página novamente. Esse é o Page
Access Token usado pelo DMFlow. Tokens têm validade e precisam ser renovados;
não existe garantia de token permanente. Se o app atender pessoas que não são
administradores/testadores, publique-o em **Live** e conclua o App Review das
permissões de mensagens/comentários antes de conectar clientes.

### 5. Descobrir o Instagram Business Account ID → campo **ID da conta Instagram**

1. No **Graph API Explorer**, com o token de usuário gerado no passo 4, rode:
   `GET /me/accounts?fields=id,name,instagram_business_account`
2. Na resposta JSON, dentro da página certa, o campo
   `instagram_business_account.id` é o valor a colar no campo **ID da conta
   Instagram** em Configurações (é um número longo, não confundir com o
   `@usuário`).

### 6. Configurar o Webhook → usa o token de verificação que você inventa

1. No menu lateral do app: **Webhooks** (ou dentro do fluxo do Instagram
   API setup, seção **Webhooks**).
2. Clique em **Editar assinatura** no objeto **Instagram**.
3. Preencha:
   - **URL de callback:** `https://SEU-DOMINIO/webhooks/instagram`
     (em produção; para testar local antes de ter domínio, use um túnel
     tipo `ngrok http 4000` e cole a URL gerada)
   - **Verificar token:** qualquer string aleatória que **você escolhe agora**
     — cole o mesmo valor no campo **Token de verificação do webhook** em
     Configurações. Não vem da Meta, é uma senha compartilhada entre seu
     app e o backend do DMFlow.
4. Clique em **Verificar e salvar** — a Meta chama seu endpoint
   (`GET /webhooks/instagram`), que precisa estar no ar respondendo o
   challenge (já implementado em `backend/src/routes/webhooks.ts`).
5. Marque os campos pra assinar: **comments**, **messages**,
   **messaging_postbacks**.

### 7. Adicionar sua própria conta como tester (evita App Review)

1. Menu lateral: **Papéis do app → Papéis**.
2. **Adicionar pessoas** → tipo **Testador do Instagram** → informe seu
   @usuário do Instagram.
3. No celular, abra o Instagram → **Configurações → Aplicativos e sites** →
   aceite o convite de testador que vai aparecer ali.

Com isso, todas as permissões (`instagram_manage_messages`,
`instagram_manage_comments`) já funcionam de verdade na sua conta, sem
passar pelo processo de App Review — ver seção abaixo.

---

## Pré-requisitos na conta

1. Conta Instagram convertida em **Instagram Business** (ou Creator).
2. Página do Facebook vinculada a essa conta Instagram.
3. Business Manager (Meta Business Suite) configurado.
4. App criado no [developers.facebook.com](https://developers.facebook.com)
   do tipo "Business", com os produtos:
   - **Webhooks**
   - **Instagram Graph API** (ou **Instagram API with Instagram Login**, mais
     recente — verificar qual está disponível na criação do app)
   - **Messenger/Instagram Messaging**

## Permissões (scopes) necessárias

A Meta mantém duas nomenclaturas em paralelo — depende de qual fluxo
aparece pra você no **Instagram API setup** dentro do app (normalmente ela
já pré-seleciona certo, isso aqui é só referência).

**Fluxo novo — "Instagram Business Login":**

| Permissão | Pra que serve |
|---|---|
| `instagram_business_basic` | Ler dados básicos da conta/mídia — base pra tudo |
| `instagram_business_manage_messages` | Obrigatória — enviar/receber DM, private reply (RF03) |
| `instagram_business_manage_comments` | Obrigatória — ler/responder comentários, o gatilho do fluxo (RF01) |

**Fluxo antigo — vinculado à Página do Facebook:**

| Permissão | Pra que serve |
|---|---|
| `instagram_basic` | Ler dados básicos da conta Instagram |
| `instagram_manage_comments` | Obrigatória — webhook de comentários + resposta (RF01) |
| `instagram_manage_messages` | Obrigatória — envio/recebimento de DM (RF03) |
| `pages_show_list` | Listar as Páginas da sua conta, pra achar a que tem o Instagram vinculado |
| `pages_read_engagement` | Ler engajamento da Página (comentários passam por aqui nesse fluxo) |

**Não precisa (pode desmarcar se a Meta oferecer):** `instagram_content_publish`
/ `instagram_business_content_publish` (publicação de posts), e qualquer
permissão de anúncios (`pages_manage_ads` etc) — fora do escopo do DMFlow.

## Como o fluxo técnico funciona no lado Meta

1. **Comentário chega** → Meta dispara webhook `comments` pro seu endpoint.
2. Payload traz `comment_id`, `media_id`, `from.id`, `text`.
3. Você usa o `comment_id` pra:
   - (opcional) responder publicamente o comentário
   - enviar uma **Private Reply** — endpoint específico que abre DM a partir
     de um comentário (`POST /{comment_id}/private_replies` ou equivalente
     na versão vigente da API — checar doc atual, esse endpoint muda de nome
     entre versões).
4. Isso abre a thread de DM com o `igsid` (Instagram-Scoped ID) do usuário.
5. Daí em diante, mensagens seguem pela **Instagram Messaging API**
   (`POST /{ig-user-id}/messages`), dentro da janela de 24h.
6. Respostas do usuário no DM chegam via webhook `messages` /
   `messaging_postbacks` (quando ele clica num botão).

## Processo de aprovação do app (App Review)

Como não é uso genérico multi-cliente, dois caminhos:

- **Modo Desenvolvimento:** funciona sem review, mas só com usuários
  cadastrados como "testadores" no app (você mesmo + contas de teste).
  **Suficiente para uso próprio em uma única conta**, se essa conta for
  adicionada como admin/tester do app.
- **Modo Live (produção):** exige App Review da Meta pra permissões como
  `instagram_manage_messages`, com vídeo de demonstração e justificativa de
  uso. Só necessário se quiser abrir pra outras contas/clientes no futuro.

➡️ **Para uso próprio, o modo Desenvolvimento com sua conta como
admin/tester já resolve — não precisa passar por App Review.**

## Verificação do negócio (Business Verification)

Pode ser exigida pela Meta dependendo do volume/permissões. Vale checar
durante a configuração do app se ela é solicitada.

## Webhook: configuração

- Endpoint: `https://hooks.example.com/webhooks/instagram` (troque pelo
  seu domínio real)
- Precisa responder ao **challenge de verificação** (`GET` com
  `hub.challenge`) na configuração inicial.
- Assinar campos: `comments`, `messages`, `messaging_postbacks`.
- Validar toda requisição recebida com o `App Secret` (HMAC SHA256 no header
  `X-Hub-Signature-256`) — sem isso, qualquer um pode forjar eventos.

## Rate limits

A Graph API tem limites por app/por usuário (calculados em "Platform Rate
Limit" pontos). Especificamente pra **private replies**, a Meta documenta um
cap de **750 envios por hora por conta conectada**.

**Implementado (RNF09):** `worker/src/services/instagram.ts` (`checkSendRateLimit`)
conta envios num contador Redis por hora, com folga de segurança em **740**
(abaixo do limite real). Quando estoura, o node que ia enviar é reagendado
pra tentar de novo (mesmo mecanismo do node "Aguardar" — ver
`docs/03-motor-de-fluxos.md`) em vez de falhar ou perder a mensagem, e fica
registrado em `messages_log` com `status: "rate_limited"`. A chave do
contador já é particionada por conta (`igUserId`), então continua correta
quando o app suportar múltiplas contas.
