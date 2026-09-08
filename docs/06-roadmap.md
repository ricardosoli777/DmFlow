# 06 — Roadmap de Construção

## Fase 0 — Setup Meta (pré-requisito, feito uma vez, sem código)
- [ ] Converter conta Instagram em Business e vincular à Página do Facebook
- [ ] Criar app em developers.facebook.com
- [ ] Adicionar produtos: Webhooks + Instagram Graph API/Messaging
- [ ] Adicionar sua conta como tester/admin do app (modo Desenvolvimento)
- [ ] Gerar Access Token de longa duração + guardar App Secret

## Fase 1 — Backend base
- [ ] Projeto Node.js (NestJS ou Fastify) + Postgres schema `dmflow`
- [ ] Endpoint webhook com verificação de challenge + validação HMAC
- [ ] Fila Redis/BullMQ conectada
- [ ] Modelagem das tabelas (contacts, flows, flow_runs, posts_triggers, messages_log)

## Fase 2 — Integração Meta mínima (prova de conceito)
- [ ] Receber webhook de comentário real (num post de teste)
- [ ] Enviar Private Reply manualmente hardcoded (sem flow engine ainda)
- [ ] Confirmar que a DM chega e que dá pra responder e receber via webhook `messages`

## Fase 3 — Flow Engine
- [ ] Estrutura de node/flow em JSON + execução da máquina de estados
- [ ] Implementar nodes: message, buttons, delay, capture, tag, webhook, end
- [ ] Associar trigger de comentário → flow → contato

## Fase 4 — Dashboard v1
- [ ] Next.js + auth simples (login único)
- [ ] Tela de Triggers (CRUD)
- [ ] Editor de Fluxo com React Flow (criar/editar/salvar grafo)
- [ ] Tela de Inbox básica

## Fase 5 — Deploy na VPS
- [ ] Dockerfile backend + frontend
- [ ] Stack no Docker Swarm (`dmflow_backend`, `dmflow_frontend`, `dmflow_worker`)
- [ ] Rota Traefik `dmflow.arkitekt.space`
- [ ] Bucket MinIO `dmflow` pra mídias
- [ ] Configurar webhook da Meta apontando pra URL de produção

## Fase 6 — Refinamento
- [ ] Métricas/funil no dashboard
- [ ] Intervenção manual na Inbox
- [ ] Segmentação por tags
- [ ] (Opcional) Node de IA usando pgvector já existente na VPS
