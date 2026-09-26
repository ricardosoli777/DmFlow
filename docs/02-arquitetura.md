# 02 — Arquitetura Técnica

## Visão macro

```
Instagram/Meta  --webhook-->  DMFlow Webhook Receiver
                                     |
                                     v
                              Fila (Redis/BullMQ)
                                     |
                                     v
                              Flow Engine (worker)
                                     |
                    +----------------+----------------+
                    v                                 v
          Instagram Graph API                   Postgres (estado)
          (envia DM / resposta)                  + MinIO (mídia)
                    |
                    v
             Dashboard (frontend) <--- API (backend) <--- Postgres
```

## Componentes

### 1. Webhook Receiver (backend)
- Endpoint HTTPS público (`POST /webhooks/instagram`) que recebe eventos da
  Meta: `comments`, `messages`, `messaging_postbacks`.
- Valida assinatura (`X-Hub-Signature-256`) com o App Secret.
- Responde 200 rápido e empilha o evento numa fila — nunca processa síncrono.

### 2. Fila de processamento
- Redis + BullMQ (Node), incluídos no Docker Compose local.
- Garante reprocessamento em caso de falha e evita perder eventos em pico.

### 3. Flow Engine (worker)
- Consome eventos da fila.
- Resolve: qual trigger corresponde a esse comentário/mensagem?
- Carrega o fluxo (grafo de nodes) do Postgres.
- Executa o node atual do contato, avança o estado da conversa
  (máquina de estados por contato+flow).
- Chama a Instagram Graph API pra enviar a mensagem/botão seguinte.

### 4. Banco de dados (Postgres)
Tabelas principais (rascunho):
- `contacts` (igsid, nome, avatar, tags[], atributos custom, criado_em)
- `posts_triggers` (post_id, palavra_chave, flow_id, ativo)
- `flows` (id, nome, definição_json do grafo, versão)
- `flow_runs` (contact_id, flow_id, node_atual, status, contexto_json)
- `messages_log` (contact_id, direção, conteúdo, timestamp)
- `events_raw` (payload bruto do webhook, pra auditoria/replay)

### 5. API (backend)
- CRUD de flows, triggers, contatos, tags.
- Endpoints de métricas.
- Autenticação por magic-link (sem senha), workspaces com papéis (owner/admin/member) — ver `docs/07`.

### 6. Dashboard (frontend)
- SPA (React/Next.js) consumindo a API.
- Editor visual de fluxo (ver `03-motor-de-fluxos.md`).
- Inbox de conversas.

### 7. Storage
- MinIO, incluído no Docker Compose local, para mídias do fluxo.

## Stack usada pelo projeto

| Camada | Escolha |
|---|---|
| Backend/API | Node.js (NestJS ou Fastify) — bom suporte a webhooks e filas |
| Fila | Redis + BullMQ (Redis já roda na VPS) |
| Banco | Postgres (instância dedicada ou compartilhada, schema `dmflow`) |
| Storage | MinIO (bucket novo `dmflow`) |
| Frontend | Next.js + React Flow (lib de editor de grafo — usada até pelo próprio n8n) |
| Deploy | Docker Compose local ou Docker Swarm + Traefik com domínios definidos pelo instalador |

## Ambientes

O Docker Compose da raiz cria serviços próprios de Postgres, Redis e MinIO.
O exemplo de Docker Swarm em `infra/` também cria esses serviços e exige
que o instalador configure uma rede externa do Traefik.
