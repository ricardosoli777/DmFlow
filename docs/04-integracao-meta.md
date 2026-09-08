# 04 — Integração com Meta / Instagram

## 🔑 Passo a passo: onde pegar cada credencial

Preencha em [`credenciais.txt`](../credenciais.txt) (rascunho local, nunca
vai pro GitHub) e depois copie pro `.env`. Caminhos exatos, na ordem:

### 1. Converter a conta e vincular a Página

1. No app do Instagram (celular): **Configurações → Conta → Mudar para conta
   profissional** → escolha **Business**.
2. Ainda nas configurações: **Contas conectadas** (ou **Central de Contas**)
   → conecte a uma **Página do Facebook** (crie uma página nova se não tiver).

### 2. Criar o app → `META_APP_ID` e `META_APP_SECRET`

1. Acesse **developers.facebook.com/apps** → **Criar app**.
2. Tipo de app: **Business** (ou "Other" → "Business" na tela seguinte).
3. Dê um nome, informe seu e-mail de contato, vincule seu Business
   Portfolio (crie um em business.facebook.com se ainda não tiver).
4. Dentro do app criado: menu lateral **Configurações do app → Básico**.
   - **App ID** aparece no topo dessa página → `META_APP_ID`
   - **Chave secreta do app** está no mesmo lugar, atrás do botão
     **Mostrar** (pede sua senha do Facebook de novo) → `META_APP_SECRET`

### 3. Adicionar o produto Instagram

1. No menu lateral do app: **Adicionar produto** → localize **Instagram**
   → **Configurar**.
2. Isso abre o fluxo **"Instagram API setup"**, com passos numerados na
   própria tela da Meta (conectar a conta Instagram Business, gerar token,
   configurar webhooks) — siga por ele, os IDs abaixo aparecem nesse fluxo.

### 4. Gerar o token de acesso → `META_PAGE_ACCESS_TOKEN`

1. Ainda em **Instagram API setup**, na etapa **"Generate access tokens"**,
   clique em **Gerar token** pra sua conta.
2. Esse token gerado ali já é de longa duração (~60 dias) — copie o valor
   inteiro → `META_PAGE_ACCESS_TOKEN`.
   - Alternativa (mais controle): **Ferramentas → Graph API Explorer** →
     selecione o app → selecione a Página → marque as permissões da seção
     abaixo → **Gerar token de acesso**. Tokens gerados assim são
     short-lived; troque por um de longa duração em
     **Configurações do app → Avançado → Ferramenta de depuração de
     token** (cole o token curto e peça pra "estender").

### 5. Descobrir o Instagram Business Account ID → `META_IG_USER_ID`

1. Em **Ferramentas → Graph API Explorer**, com o token gerado no passo 4:
2. Rode: `GET /me/accounts?fields=instagram_business_account`
3. Na resposta JSON, dentro da página certa, o campo
   `instagram_business_account.id` é o valor → `META_IG_USER_ID`
   (é um número longo, não confundir com o `@usuário`).

### 6. Configurar o Webhook → usa o `META_VERIFY_TOKEN` que você inventa

1. No menu lateral do app: **Webhooks** (ou dentro do fluxo do Instagram
   API setup, seção **Webhooks**).
2. Clique em **Editar assinatura** no objeto **Instagram**.
3. Preencha:
   - **URL de callback:** `https://SEU-DOMINIO/webhooks/instagram`
     (em produção; para testar local antes de ter domínio, use um túnel
     tipo `ngrok http 4000` e cole a URL gerada)
   - **Verificar token:** qualquer string aleatória que **você escolhe agora**
     — cole o mesmo valor em `META_VERIFY_TOKEN` no `.env`. Não vem da Meta,
     é uma senha compartilhada entre seu app e o backend do DMFlow.
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
| `pages_manage_metadata` | Assinar webhooks via API — a Meta às vezes exige mesmo configurando pela UI |

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

- Endpoint: `https://hooks.arkitekt.space/webhooks/instagram`
- Precisa responder ao **challenge de verificação** (`GET` com
  `hub.challenge`) na configuração inicial.
- Assinar campos: `comments`, `messages`, `messaging_postbacks`.
- Validar toda requisição recebida com o `App Secret` (HMAC SHA256 no header
  `X-Hub-Signature-256`) — sem isso, qualquer um pode forjar eventos.

## Rate limits

A Graph API tem limites por app/por usuário (calculados em "Platform Rate
Limit" pontos). Para uso próprio (1 conta, volume moderado) não deve ser
problema, mas o flow engine deve ter retry/backoff em caso de 429.
