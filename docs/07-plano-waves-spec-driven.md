# 07 — Plano de Execução em Waves (Spec-Driven)

Repositório: https://github.com/ricardosoli777/DmFlow

## Método

Cada **wave** agrupa etapas que podem (ou precisam) andar juntas. Dentro de
cada etapa roda um **loop spec-driven**:

```
SPEC → PLAN → EXECUTE → VERIFY
  ^                        |
  └────── ajusta se reprovar ┘
```

- **SPEC:** o que a etapa entrega, critérios de aceite testáveis (não
  ambíguos — "webhook responde 200 e grava evento em <200ms", não "webhook
  funciona bem").
- **PLAN:** arquivos a criar/alterar, ordem de tarefas, dependências.
- **EXECUTE:** implementação com commits atômicos, um por tarefa do plano.
- **VERIFY:** checagem *goal-backward* — volta no SPEC e confirma que cada
  critério de aceite realmente foi satisfeito (não só "rodou sem erro").
  Se falhar, reabre o loop na etapa, sem avançar de wave.

Uma wave só é considerada concluída quando **todas as etapas dela passam no
VERIFY**. Isso evita dívida técnica se acumulando silenciosamente — decisivo
aqui porque o objetivo final é que **terceiros sem conhecimento técnico
consigam clonar o repo e subir o app funcionando**, então cada etapa mal
verificada vira um ponto de quebra no onboarding de outra pessoa.

---

## Wave 0 — Fundação (sequencial, bloqueia todas as outras)

| Etapa | Entrega | Critério de aceite |
|---|---|---|
| 0.1 Spec do produto | `PROJECT-SPEC.md` consolidando docs 01-06 em requisitos funcionais + não funcionais + critérios de aceite | Todo requisito tem um critério testável associado |
| 0.2 Setup do repositório | Monorepo (`backend/`, `frontend/`, `worker/`, `infra/`), `.gitignore`, `LICENSE`, `CONTRIBUTING.md` | `git clone` + `ls` mostra a estrutura completa; nenhum segredo commitado |
| 0.3 Setup Meta (manual, fora de código) | App criado em developers.facebook.com, conta IG Business vinculada, você como tester | Consegue chamar `GET /me` na Graph API com o token gerado e receber sua própria conta |
| 0.4 CI esqueleto | GitHub Actions rodando lint/build a cada push (mesmo vazio no início) | Badge de CI verde no README |

**Não avança pra Wave 1 sem 0.1–0.4 verificados.**

---

## Wave 1 — Núcleo Backend (3 etapas em paralelo entre si)

Pré-requisito: Wave 0 completa.

| Etapa | Entrega | Critério de aceite |
|---|---|---|
| 1A — Webhook Receiver | `POST /webhooks/instagram` com verificação de challenge + validação HMAC (`X-Hub-Signature-256`) | Payload com assinatura inválida recebe 401; challenge do Meta é respondido corretamente; evento válido é gravado em `events_raw` |
| 1B — Banco de dados | Schema `dmflow` no Postgres: `contacts`, `flows`, `flow_runs`, `posts_triggers`, `messages_log`, `events_raw` + migrations versionadas | `npm run migrate` do zero cria o schema completo sem erro; rollback funciona |
| 1C — Fila | Redis + BullMQ configurados, worker consumindo fila de eventos | Evento publicado na fila é consumido e logado em <1s em teste local |

**Verify da wave:** subir os 3 containers localmente via `docker compose up`
e confirmar que um evento sintético (mock de comentário) percorre
webhook → fila → worker → log no banco, ponta a ponta.

---

## Wave 2 — Integração Meta Real

Pré-requisito: Wave 1 completa + Wave 0.3 (app Meta configurado).

| Etapa | Entrega | Critério de aceite | Status |
|---|---|---|---|
| 2A — Envio de DM | Serviço que chama Private Reply + Instagram Messaging API | Comentário real de teste dispara DM real na sua conta | Código pronto e credenciais reais configuradas (app "klead - IG") — falta só apontar o webhook na Meta pra validar com comentário real |
| 2B — Recebimento de resposta | Handler de `messages`/`messaging_postbacks` gravando resposta do usuário | Responder a DM de teste gera registro em `messages_log` em até 1 wave de webhook | Código pronto, pipeline completo verificado (ver abaixo) |
| 2C — Janela de 24h | Checagem de timestamp antes de enviar mensagem fora do gatilho imediato | Tentativa de envio fora da janela é bloqueada e logada, não falha silenciosamente | ✅ Pronto — `Contact.lastInboundAt` + bloqueio logado como `Message.direction = "blocked"` |

**Verify da wave — feito em produção (2026-09-08):**
- ✅ `GET /webhooks/instagram` com o verify token certo → responde o
  `hub.challenge` (HTTP 200); com token errado → 403. Handshake da Meta vai
  funcionar quando configurado.
- ✅ Simulei um evento de comentário real (payload assinado com HMAC do App
  Secret de verdade) via `POST /webhooks/instagram` → pipeline completo
  rodou: webhook validou a assinatura → publicou na fila → o worker
  consumiu → criou o contato no banco → marcou o evento como processado.
  Nenhum DM foi enviado porque não havia trigger cadastrado pro post de
  teste (comportamento correto, RF02).
- ⏳ **Falta só:** configurar a URL do webhook no painel da Meta
  (`https://hooks.arkitekt.space/webhooks/instagram` + o verify token) e
  testar com um comentário real, numa conta/post de verdade — só isso
  depende de uma ação manual sua no painel da Meta, não de código.

---

## Wave 3 — Flow Engine

Pré-requisito: Wave 2 completa.

| Etapa | Entrega | Critério de aceite |
|---|---|---|
| 3A — Máquina de estados | Execução de grafo JSON (node atual, avanço, contexto por `flow_run`) | Fluxo de teste com 3 nodes lineares completa do início ao fim sem intervenção |
| 3B — Node types | `message`, `buttons`, `delay`, `condition`, `capture`, `tag`, `webhook`, `end` | Cada tipo tem teste automatizado isolado passando |
| 3C — Trigger → Flow → Contato | Associação de post+palavra-chave a um flow, criação automática de `flow_run` no primeiro comentário | Comentário com palavra-chave certa inicia o flow certo; palavra errada não dispara nada |

**Verify da wave:** flow completo (boas-vindas → pergunta → captura de
e-mail → tag → fim) rodando 100% via engine, sem código hardcoded.

---

## Wave 4 — Dashboard (pode começar em paralelo com Wave 3, consumindo API mockada)

| Etapa | Entrega | Critério de aceite |
|---|---|---|
| 4A — Auth | Login único (usuário/senha ou API key) | Rota protegida rejeita acesso sem sessão válida |
| 4B — CRUD de Triggers | Tela criar/editar/pausar trigger | Criar trigger na UI reflete no banco e passa a valer no próximo comentário real |
| 4C — Editor de Fluxo | Canvas React Flow, salvar grafo como JSON válido pro engine | Fluxo desenhado na UI roda sem erro no engine real (reusa Wave 3) |
| 4D — Inbox | Lista de conversas + intervenção manual | Consigo ver uma conversa real e mandar mensagem manual que chega no Instagram |

**Verify da wave:** criar um flow do zero só pela UI, sem tocar em banco/API
diretamente, e ver ele funcionar num comentário real.

---

## Wave 5 — Empacotamento & Reprodutibilidade (começa cedo, evolui a cada wave)

Ver detalhamento completo em
[`08-reprodutibilidade-docker-github.md`](08-reprodutibilidade-docker-github.md).

| Etapa | Entrega | Critério de aceite |
|---|---|---|
| 5A — Dockerfiles | Imagens multi-stage backend/worker/frontend | `docker build` de cada uma sem erro, imagem final <300MB |
| 5B — docker-compose | Compose completo (postgres, redis, minio, backend, worker, frontend) | `docker compose up -d` sobe tudo saudável (`healthcheck` verde) numa máquina limpa |
| 5C — CI de imagem | GitHub Actions builda e publica no GHCR a cada release | Tag `v0.1.0` gera imagem pública em `ghcr.io/ricardosoli777/dmflow` |
| 5D — Onboarding zero-conhecimento | README "Quickstart", `.env.example` comentado, script `setup.sh`/`setup.ps1` | Uma pessoa que nunca viu o projeto segue só o README e sobe o app rodando em <15min |

**Verify da wave:** teste real com uma máquina/pasta limpa (ou peça pra
alguém de fora testar) seguindo só o README.

---

## Wave 6 — Deploy em Produção (VPS arkitekt.space)

Pré-requisito: Wave 5 completa (a imagem já reproduzível é a mesma que vai
pra produção).

| Etapa | Entrega | Critério de aceite | Status |
|---|---|---|---|
| 6A — Stack Swarm | `docker stack deploy -c infra/docker-stack.yml dmflow` usando as imagens do GHCR | Serviço `dmflow_*` aparece `Running` no `docker service ls` | ✅ Feito — todos os 7 serviços `1/1` (migrate `0/1` é esperado, roda uma vez e conclui) |
| 6B — Traefik + domínio | `dmflow.arkitekt.space` (dashboard) + `hooks.arkitekt.space` (API/webhook) com HTTPS | Sites acessíveis via HTTPS, certificado válido | ✅ Confirmado: `dmflow.arkitekt.space` → HTTP 200, `hooks.arkitekt.space/health` → HTTP 200 |
| 6C — Webhook produção | Webhook da Meta reapontado pra URL de produção | Evento real de comentário processado em produção, ponta a ponta | Pendente — falta configurar o webhook no painel da Meta apontando pra `https://hooks.arkitekt.space/webhooks/instagram` (passo 3 do "klead - IG") |

### Bugs corrigidos no deploy real (não apareciam em build local)

1. **`@dmflow/db` sem build** — `package.json` apontava `main` direto pro `.ts`, funcionava em dev (`tsx`) mas quebrava em runtime com `node` puro. Corrigido: `tsconfig.json` + script `build` compilando pra `dist/`.
2. **Prisma sem OpenSSL no Alpine** — `node:20-alpine` não traz `openssl`; Prisma detectava errado e tentava rebaixar engine em runtime, esbarrando em permissão (container roda non-root). Corrigido: `apk add --no-cache openssl` nos Dockerfiles.
3. **Migration inicial nunca gerada** — só existia `schema.prisma`, sem `prisma/migrations/`. `migrate deploy` rodava sem erro mas não criava nenhuma tabela. Corrigido: migration gerada via `prisma migrate diff --from-empty` e commitada.
4. **Next.js `standalone` não escutava em `0.0.0.0`** — o mais sutil: o server só respondia em `localhost`/IPv6 dentro do container, então nem o próprio healthcheck conseguia conectar (`Connection refused`), e o Swarm matava a task silenciosamente (exit limpo). Corrigido: `ENV HOSTNAME=0.0.0.0` no Dockerfile (fix oficial do Next.js pra Docker).

**Lição pro processo:** todos os 4 só apareceram rodando o deploy de verdade — reforça por que o "Verify" de cada wave não pode ser só "buildou sem erro".

---

## Wave 7 — Hardening & Observabilidade (contínua, pode rodar em paralelo desde a Wave 5)

- Logs estruturados + retenção
- Métricas de funil no dashboard
- Alertas de falha de webhook (a Meta desativa webhook após muitas falhas)
- Backup do schema `dmflow` incluído na rotina de backup já existente na VPS

---

## Resumo de dependências

```
Wave 0 (fundação)
   └─▶ Wave 1 (backend núcleo) ──▶ Wave 2 (Meta real) ──▶ Wave 3 (flow engine)
                                                              │
   Wave 5 (docker/reprodutibilidade) ◀── evolui junto ───────┤
                                                              ▼
                                          Wave 4 (dashboard, paralela à 3)
                                                              │
                                                              ▼
                                          Wave 6 (deploy produção)
                                                              │
                                                              ▼
                                          Wave 7 (hardening, contínua)
```
