<p align="center">
  <img src="frontend/public/logo-wordmark.svg" alt="DMFlow" width="280" />
</p>

Automação de DM do Instagram estilo ManyChat — para uso próprio, com painel
visual de arrastar-e-soltar pra montar os fluxos de conversa.

Repositório: https://github.com/ricardosoli777/DmFlow

## O que é

Quando alguém comenta em um post/reel (ex: "comenta AQUI que eu te mando no
DM"), o DMFlow detecta o comentário, dispara uma mensagem privada automática
e conduz o usuário por um fluxo de conversa configurável — tudo desenhado
visualmente no dashboard, sem escrever código.

---

## 🚀 Como rodar (qualquer pessoa, sem saber programar)

**Pré-requisito único: [Docker Desktop](https://www.docker.com/products/docker-desktop) instalado.**

1. Baixe este repositório: botão verde **Code → Download ZIP** (ou
   `git clone https://github.com/ricardosoli777/DmFlow.git` se souber git).
2. Abra a pasta baixada.
3. Rode o script de setup:
   - **Windows:** clique com o botão direito em `setup.ps1` → "Executar com PowerShell"
   - **Mac/Linux:** abra o terminal na pasta e rode `./setup.sh`
4. Na primeira vez, ele vai criar um arquivo `.env` só com a infraestrutura
   (banco, fila, storage) e o login inicial do dashboard — não precisa mais
   preencher nenhuma credencial da Meta aqui.
5. Rode o script de novo. Ele vai baixar as imagens prontas e subir tudo.
6. Acesse **http://localhost:3000**, faça login com o e-mail/senha que você
   definiu no `.env` e vá em **Configurações** (`/settings`) pra colar as
   credenciais da sua conta Meta/Instagram (veja onde pegar cada uma logo
   abaixo). Elas ficam guardadas no banco de dados do próprio app — cada
   pessoa que for rodar o DMFlow usa as suas, sem editar arquivo nenhum.

Isso sobe: banco de dados, fila, armazenamento de arquivos, API, worker
(motor de automação) e o dashboard — tudo junto, isolado, sem precisar
instalar Node, Postgres ou qualquer outra coisa manualmente.

### 🔑 Onde pegar cada credencial da Meta

Cole cada uma direto no dashboard, em **Configurações** (`/settings`) —
tem um tooltip passo a passo em cada campo. Passo a passo completo, com
telas e nomes de menu, em [`docs/04-integracao-meta.md`](docs/04-integracao-meta.md#-passo-a-passo-onde-pegar-cada-credencial).
Resumo:

| Campo em Configurações | Onde pegar |
|---|---|
| **App ID** / **App Secret** | developers.facebook.com/apps → seu app → **Configurações do app → Básico** |
| **Token de acesso da página** | Dentro do app → **Adicionar produto → Instagram → Instagram API setup** → etapa "Generate access tokens" |
| **ID da conta Instagram** | **Ferramentas → Graph API Explorer** → `GET /me/accounts?fields=instagram_business_account` |
| **Token de verificação do webhook** | Você mesmo inventa (senha aleatória) — usa o mesmo valor ao configurar o Webhook no app |

Antes de tudo isso: a conta Instagram precisa ser **Business** e estar
vinculada a uma **Página do Facebook** (Instagram → Configurações → Contas
conectadas), e sua própria conta precisa estar como **testador** do app
(**Papéis do app → Papéis → Adicionar pessoas**) — assim você usa tudo sem
precisar passar pelo App Review da Meta.

## 🛠 Como rodar (desenvolvedor, ambiente de desenvolvimento local)

```bash
# 1. instale as dependências de todo o monorepo (workspaces)
npm install

# 2. copie o .env de exemplo e preencha
cp .env.example .env

# 3. suba só a infraestrutura (postgres/redis/minio) via Docker
docker compose up -d postgres redis minio

# 4. gere o client do Prisma e rode as migrations
npm run db:generate
npm run db:migrate

# 5. rode backend, worker e frontend em paralelo (3 terminais)
npm run dev:backend
npm run dev:worker
npm run dev:frontend
```

Dashboard em `http://localhost:3000`, API em `http://localhost:4000`.

## ☁️ Deploy em produção (VPS própria, Docker Swarm)

Se a VPS já roda Traefik + Docker Swarm com outros serviços, o DMFlow usa um
stack próprio, isolado, que só referencia as imagens já publicadas no GHCR
(nada de build na VPS) e reaproveita a mesma rede/certresolver do Traefik
que os outros serviços já usam — nenhum outro serviço é alterado.

- **Dashboard:** `dmflow.example.com` (troque pelo seu domínio)
- **API / Webhook:** `hooks.example.com` (o webhook da Meta aponta pra
  `https://hooks.example.com/webhooks/instagram`)
- **Stack file:** [`infra/docker-stack.yml`](infra/docker-stack.yml)

```bash
# na VPS, dentro da pasta do repositório, com o .env preenchido:
docker stack deploy -c infra/docker-stack.yml dmflow
```

Isso **nunca é executado automaticamente** — é sempre um comando manual, pra
não arriscar mexer nos outros serviços da VPS sem confirmação.

### Deploy numa VPS própria diferente (sem Swarm)

1. Instale Docker + Docker Compose na VPS.
2. Clone o repositório, copie `.env.example` → `.env` e preencha.
3. Rode `./setup.sh` — puxa as imagens do GHCR, sem buildar nada na VPS.
4. Coloque um proxy reverso com HTTPS (Traefik/Nginx/Caddy) na frente do
   `frontend` (porta 3000) e do `backend` (porta 4000, rota `/webhooks/*`
   precisa ficar pública pra Meta conseguir chamar).

Guia completo: [`docs/08-reprodutibilidade-docker-github.md`](docs/08-reprodutibilidade-docker-github.md).

---

## Estrutura do monorepo

```
DMFlow/
├── backend/          → API + webhook receiver (Fastify + Prisma)
├── worker/            → Flow engine — motor que executa os fluxos (BullMQ)
├── frontend/           → Dashboard (Next.js + Tailwind + React Flow + Zustand)
├── packages/db/         → Schema Prisma compartilhado entre backend e worker
├── docs/                → Documentação completa (produto, arquitetura, plano, design system)
├── infra/docker-stack.yml → Stack de produção (Docker Swarm + Traefik, VPS)
├── docker-compose.yml     → Sobe tudo localmente (dev/uso pessoal com build)
├── .env.example            → Todas as variáveis necessárias, comentadas
├── setup.sh / setup.ps1     → Script de instalação guiada
└── PROJECT-SPEC.md            → Requisitos funcionais/não funcionais com critério de aceite
```

### Stack técnica

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + React Flow + Zustand + TanStack Query |
| Backend | Fastify + Prisma + Zod + BullMQ |
| Worker | Node.js + BullMQ (mesma base de dados via `@dmflow/db`) |
| Banco | PostgreSQL |
| Fila | Redis |
| Storage | MinIO |
| Deploy | Docker + Docker Compose / Docker Swarm, imagens publicadas no GHCR via GitHub Actions |

## Documentação

- [01 — Visão Geral do Produto](docs/01-visao-geral.md)
- [02 — Arquitetura Técnica](docs/02-arquitetura.md)
- [03 — Motor de Fluxos (Flow Engine)](docs/03-motor-de-fluxos.md)
- [04 — Integração com Meta/Instagram](docs/04-integracao-meta.md)
- [05 — Dashboard](docs/05-dashboard.md)
- [06 — Roadmap de Construção (visão simples)](docs/06-roadmap.md)
- [07 — Plano de Execução em Waves (Spec-Driven)](docs/07-plano-waves-spec-driven.md)
- [08 — Reprodutibilidade via GitHub + Docker](docs/08-reprodutibilidade-docker-github.md)
- [09 — Design System](docs/09-design-system.md)
- [PROJECT-SPEC.md — Requisitos e critérios de aceite](PROJECT-SPEC.md)
- [CONTRIBUTING.md — Fluxo de contribuição](CONTRIBUTING.md)

## Status atual

- ✅ Wave 0 — fundação do monorepo
- ✅ Wave 1 — backend/worker/frontend base (webhook, banco, fila, dashboard)
- ✅ **Wave 2 — Meta conectada e webhook validado em produção:** app
  "klead - IG" configurado, conta `@oricasoares` conectada e verificada via
  Graph API (visível em `/settings`), webhook confirmado pela Meta (handshake
  `hub.challenge` respondido com sucesso). Falta só testar um comentário real
  ponta a ponta.
- 🟡 Wave 3/4 (flow engine + dashboard) — bastante avançado:
  - Editor de fluxo com drag-and-drop (React Flow), 11 tipos de node
    (mensagem, botões com CTA, imagem, áudio, vídeo, aguardar, condição,
    capturar, tag, webhook, fim)
  - Nodes mostram o conteúdo configurado direto no card; exclusão via
    tecla Delete ou ícone no próprio node
  - `/settings` — credenciais da Meta/Instagram configuradas direto pelo
    dashboard (com passo a passo em cada campo), guardadas no banco —
    não usa mais `.env` pra isso
  - `/triggers` — formulário real de criação (post + palavra-chave + fluxo)
  - Pendente: agendamento real do node "Aguardar" (fila com atraso), upload
    de mídia por arrastar-e-soltar (hoje é só URL), edição de texto inline
    no canvas
- ✅ **Wave 6 — no ar em produção:** https://dmflow.example.com
  (dashboard) e https://hooks.example.com (API/webhook), rodando via
  Docker Swarm numa VPS própria

Ver [`docs/07-plano-waves-spec-driven.md`](docs/07-plano-waves-spec-driven.md)
pro estado detalhado de cada etapa.
