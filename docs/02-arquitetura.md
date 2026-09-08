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
- Redis (já existe na VPS) + BullMQ (Node) ou Celery (Python).
- Garante reprocessamento em caso de falha e evita perder eventos em pico.

### 3. Flow Engine (worker)
- Consome eventos da fila.
- Resolve: qual trigger corresponde a esse comentário/mensagem?
- Carrega o fluxo (grafo de nodes) do Postgres.
- Executa o node atual do contato, avança o estado da conversa
  (máquina de estados por contato+flow).
- Chama a Instagram Graph API pra enviar a mensagem/botão seguinte.

### 4. Banco de dados (Postgres — reaproveita `pgvector` da VPS)
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
- Autenticação simples (é uso próprio — login único ou API key).

### 6. Dashboard (frontend)
- SPA (React/Next.js) consumindo a API.
- Editor visual de fluxo (ver `03-motor-de-fluxos.md`).
- Inbox de conversas.

### 7. Storage
- MinIO (já existe) pra mídias enviadas no fluxo (imagens/vídeos/áudios).

## Stack sugerida (reaproveitando o que já existe na VPS)

| Camada | Escolha |
|---|---|
| Backend/API | Node.js (NestJS ou Fastify) — bom suporte a webhooks e filas |
| Fila | Redis + BullMQ (Redis já roda na VPS) |
| Banco | Postgres (instância `pgvector` já existente, schema novo `dmflow`) |
| Storage | MinIO (bucket novo `dmflow`) |
| Frontend | Next.js + React Flow (lib de editor de grafo — usada até pelo próprio n8n) |
| Deploy | Docker Swarm + Traefik — `dmflow.arkitekt.space` (dashboard) e `hooks.arkitekt.space` (API/webhook) |

## Por que reaproveitar a VPS

Você já tem Postgres, Redis (via EvoAI), MinIO, Traefik e Swarm rodando e
monitorados (backup, fail2ban, health-check). Subir o DMFlow como mais um
stack Swarm evita provisionar infra nova — só precisa de um schema/bucket
isolado e um novo serviço no Swarm.
