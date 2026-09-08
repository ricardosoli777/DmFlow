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
    { "id": "n5", "type": "webhook", "url": "https://api-evocrm.arkitekt.space/...", "next": "n6" },
    { "id": "n6", "type": "message", "text": "Prontinho! ✅" }
  ],
  "start": "n1"
}
```

## Tipos de node (v1)

| Tipo | Função |
|---|---|
| `message` | Envia texto (ou mídia via MinIO) |
| `buttons` | Envia quick replies / botões; próximo node depende da escolha |
| `delay` | Espera N segundos/minutos antes do próximo node |
| `condition` | Ramifica com base em atributo/tag do contato |
| `capture` | Espera resposta livre do usuário e salva num campo do contato |
| `tag` | Adiciona/remove tag do contato |
| `webhook` | Chama uma URL externa (ex: EvoAI CRM, planilha, Zapman) |
| `end` | Encerra o flow_run |

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

## Regra importante da Meta (janela de mensagens)

A Instagram Messaging API só permite enviar mensagens livres dentro de uma
**janela de 24h** a partir da última interação do usuário (comentário conta
como abertura de janela para resposta privada — "Private Replies"). Fora
dessa janela, só é permitido enviar com tags especiais (`HUMAN_AGENT`, etc,
quando aplicável) ou nada, dependendo da política vigente. O flow engine
precisa checar o timestamp da última interação antes de mandar mensagem fora
de node imediato (ex: em `delay` longos) — ver `04-integracao-meta.md`.
