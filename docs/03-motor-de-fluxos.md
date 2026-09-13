# 03 — Motor de Fluxos (Flow Engine)

## Modelo de dados do fluxo

Um flow é um grafo: nós (nodes) conectados por arestas (edges), salvo como
JSON. Cada contato tem um `flow_run` que aponta pro node atual + um contexto
(variáveis capturadas).

```json
{
  "id": "flow_boas_vindas",
  "nodes": [
    { "id": "n1", "type": "message", "text": "Oi! Vou te mandar o material 🚀" },
    { "id": "n2", "type": "buttons", "text": "Você já é cliente?", "options": [
        { "label": "Sim", "next": "n3" },
        { "label": "Não", "next": "n4" }
      ]
    },
    { "id": "n3", "type": "tag", "tag": "cliente", "next": "n5" },
    { "id": "n4", "type": "capture", "field": "email", "prompt": "Qual seu e-mail?", "next": "n5" },
    { "id": "n5", "type": "webhook", "url": "https://api.crm.example.com/...", "next": "n6" },
    { "id": "n6", "type": "message", "text": "Prontinho! ✅" }
  ],
  "start": "n1"
}
```

## O que dispara um fluxo (trigger)

Um **trigger** é o evento que faz o `worker` criar um `flow_run` novo pra um
contato. Hoje existem dois tipos implementados (`PostTrigger.type`); os
outros são só automação de Instagram conhecida no mercado, ainda não
construída aqui — servem de lista pra decidir o que vale a pena adicionar
depois.

### Implementado

| Trigger | Como funciona | Onde configurar |
|---|---|---|
| **Comentário em post/reel** (`type: comment`) | Alguém comenta num post específico → dispara o fluxo escolhido. Sem palavra-chave, dispara em **qualquer** comentário do post; com palavra-chave, dispara quando o comentário **contiver** essa palavra (não precisa ser idêntico). Se o post tiver os dois tipos de trigger cadastrados, a palavra-chave específica tem prioridade sobre o "qualquer". Webhook `comments` da Meta. | `/triggers` no dashboard |
| **DM com palavra-chave** (`type: dm_keyword`) | Alguém manda uma DM direta pra conta, sem ter comentado nada, contendo uma palavra específica → dispara um fluxo. Só é avaliado quando a pessoa **não tem** nenhum `flow_run` ativo esperando resposta (senão a mensagem é tratada como resposta ao fluxo em andamento). Match por "contém", igual ao de comentário. Webhook `messages`. | `/triggers` no dashboard |

### Não implementado (candidatos pra adicionar)

| Trigger | O que seria | Webhook/API envolvido | Complexidade |
|---|---|---|---|
| **Resposta a Story** | Usuário responde (reply) a um story publicado pela conta → dispara um fluxo | Webhook `messages` com campo `reply_to.story` preenchido | Baixa/média — é uma variação do trigger de DM, só muda a detecção |
| **Menção em post/story de terceiros** | Alguém marca a conta em post ou story próprio → dispara um fluxo (ex: agradecimento automático) | Webhook `mentions` (permissão `instagram_manage_mentions`) | Média — precisa de permissão nova no app da Meta e um endpoint de webhook novo |
| **Clique em anúncio (Click-to-Instagram/CTWA)** | Alguém clica num anúncio configurado pra abrir DM → a primeira mensagem chega com um `referral` de campanha → dispara um fluxo específico daquele anúncio | Webhook `messages`, campo `referral` | Média — precisa mapear `ref`/`ad_id` pra um fluxo, parecido com o trigger de post mas pra anúncios |
| **Novo seguidor** | Alguém começa a seguir a conta → dispara uma DM de boas-vindas | Não existe webhook direto da Meta pra isso hoje (a Instagram Graph API não notifica novos seguidores em tempo real) | Alta — provavelmente exigiria polling periódico, não é um caso bem suportado pela API |

## Tipos de node dentro de um fluxo

| Tipo | Função |
|---|---|
| `message` | Texto livre; aceita CTA opcional (botão que vai pra outro node, ou abre link externo) |
| `buttons` | Igual `message`, mas sempre pensado pra ter opções — mesmo motor de CTA por baixo |
| `image` / `audio` / `video` | Envia mídia por URL pública; aceita o mesmo CTA opcional de `message` |
| `delay` | Espera N segundos/minutos antes do próximo node (agendamento real ainda não implementado — ver pendências) |
| `condition` | Ramifica com base num atributo/tag salvo do contato (`thenNext`/`elseNext`) |
| `capture` | Espera resposta livre do usuário e salva num campo do contato |
| `tag` | Adiciona uma tag ao contato |
| `webhook` | Chama uma URL externa (ex: CRM, planilha, automação) |
| `end` | Encerra o `flow_run` |

Cada botão de CTA (em `message`, `buttons`, `image`, `audio`, `video`) é ou
`next` (vai pra outro node do fluxo via postback) ou `url` (abre um link
externo) — nunca os dois ao mesmo tempo. Ver `worker/src/engine/node-handlers.ts`.

## Execução

1. Evento chega (comentário ou resposta de DM) → engine identifica o
   `contact_id` e o `flow_run` ativo (ou cria um novo, se for trigger de
   comentário).
2. Engine lê o node atual, executa a ação associada.
3. Se o node espera input do usuário (`buttons`, `capture`), o `flow_run`
   fica "aguardando" — próximo evento do usuário resolve o node.
4. Se o node é automático (`message`, `delay`, `tag`, `webhook`), o engine já
   avança pro `next` sozinho.
5. Loga cada passo em `messages_log` pra auditoria/analytics.

## Pendências conhecidas

- **`delay` não espera de verdade.** Hoje o node só avança pro `next`
  imediatamente (`worker/src/engine/node-handlers.ts`) — não existe
  agendamento real (ex: job atrasado no BullMQ). Um fluxo com `delay` de
  "esperar 1 hora" hoje não espera nada. Fica pra quando alguém precisar de
  verdade de um delay maior que alguns segundos.
- **Inbox sem conversa completa.** A tela de Inbox lista contatos, mas não
  tem uma view de thread (mensagens indo e vindo) nem envio manual real —
  `POST /contacts/:id/messages` já existe no backend mas só grava no log,
  ainda não chama a Instagram Messaging API de verdade.

## Regra importante da Meta (janela de mensagens)

A Instagram Messaging API só permite enviar mensagens livres dentro de uma
**janela de 24h** a partir da última interação do usuário (comentário conta
como abertura de janela para resposta privada — "Private Replies"). Fora
dessa janela, só é permitido enviar com tags especiais (`HUMAN_AGENT`, etc,
quando aplicável) ou nada, dependendo da política vigente. O flow engine
precisa checar o timestamp da última interação antes de mandar mensagem fora
de node imediato (ex: em `delay` longos) — ver `04-integracao-meta.md`.
