# DMFlow

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
4. Na primeira vez, ele vai criar um arquivo `.env` e pedir pra você
   preenchê-lo. Abra o `.env` num editor de texto e preencha:
   - As credenciais do Meta (veja o passo a passo em
     [`docs/04-integracao-meta.md`](docs/04-integracao-meta.md))
   - Um e-mail/senha de sua escolha pra ser o login do dashboard
5. Rode o script de novo. Ele vai baixar as imagens prontas e subir tudo.
6. Acesse **http://localhost:3000** e faça login com o e-mail/senha que você
   definiu no `.env`.

Isso sobe: banco de dados, fila, armazenamento de arquivos, API, worker
(motor de automação) e o dashboard — tudo junto, isolado, sem precisar
instalar Node, Postgres ou qualquer outra coisa manualmente.

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

## ☁️ Como fazer deploy numa VPS própria

1. Instale Docker + Docker Compose na VPS.
2. Clone o repositório na VPS.
3. Copie `.env.example` para `.env` e preencha (use domínio real se for
   expor publicamente, e configure o webhook da Meta apontando pra ele).
4. Rode `./setup.sh` — ele puxa as imagens já publicadas em
   `ghcr.io/ricardosoli777/dmflow-*` (geradas automaticamente pelo CI a cada
   release, ver [`.github/workflows/release.yml`](.github/workflows/release.yml)),
   então não precisa buildar nada na VPS.
5. Coloque um proxy reverso com HTTPS na frente (Traefik/Nginx/Caddy)
   apontando pro `frontend` (porta 3000) e pro `backend` (porta 4000, rota
   `/webhooks/*` precisa ficar pública pra Meta conseguir chamar).

Guia completo e detalhado: [`docs/08-reprodutibilidade-docker-github.md`](docs/08-reprodutibilidade-docker-github.md).

---

## Estrutura do monorepo

```
DMFlow/
├── backend/          → API + webhook receiver (Fastify + Prisma)
├── worker/            → Flow engine — motor que executa os fluxos (BullMQ)
├── frontend/           → Dashboard (Next.js + Tailwind + React Flow + Zustand)
├── packages/db/         → Schema Prisma compartilhado entre backend e worker
├── docs/                → Documentação completa (produto, arquitetura, plano, design system)
├── docker-compose.yml     → Sobe tudo de uma vez
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

Fundação do monorepo criada (Wave 0) + esqueleto funcional de backend,
worker e frontend (Waves 1-4 em andamento). Ver
[`docs/07-plano-waves-spec-driven.md`](docs/07-plano-waves-spec-driven.md)
pro estado detalhado de cada etapa.
