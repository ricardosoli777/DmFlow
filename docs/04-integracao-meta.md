# 04 — Integração com Meta / Instagram

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

- `instagram_basic`
- `instagram_manage_comments`
- `instagram_manage_messages`
- `pages_show_list`
- `pages_manage_metadata`
- `pages_read_engagement`
- Dependendo da versão da API: `instagram_business_manage_messages` etc —
  a nomenclatura muda com frequência, checar changelog da Graph API na hora
  de implementar.

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

- Endpoint: `https://dmflow.arkitekt.space/webhooks/instagram`
- Precisa responder ao **challenge de verificação** (`GET` com
  `hub.challenge`) na configuração inicial.
- Assinar campos: `comments`, `messages`, `messaging_postbacks`.
- Validar toda requisição recebida com o `App Secret` (HMAC SHA256 no header
  `X-Hub-Signature-256`) — sem isso, qualquer um pode forjar eventos.

## Rate limits

A Graph API tem limites por app/por usuário (calculados em "Platform Rate
Limit" pontos). Para uso próprio (1 conta, volume moderado) não deve ser
problema, mas o flow engine deve ter retry/backoff em caso de 429.
