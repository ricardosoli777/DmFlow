# 08 — Reprodutibilidade via GitHub + Docker

Objetivo: qualquer pessoa, **sem conhecimento técnico**, clona
https://github.com/ricardosoli777/DmFlow e sobe o app funcionando com poucos
comandos, usando a imagem publicada no GitHub.

## Peças necessárias

### 1. Dockerfiles multi-stage (`backend/Dockerfile`, `frontend/Dockerfile`, `worker/Dockerfile`)
- Stage `build`: instala deps, compila (TypeScript → JS, Next.js build).
- Stage `runtime`: imagem enxuta (`node:20-alpine`), só o build final + deps
  de produção.
- Usuário non-root, `HEALTHCHECK` definido em cada imagem.

### 2. `docker-compose.yml` na raiz do repo
Serviços:
- `postgres` (com volume persistente)
- `redis`
- `minio` (com volume persistente)
- `backend` (API)
- `worker` (flow engine)
- `frontend` (dashboard)
- Rede interna única; só `frontend`/`backend` expõem porta pro host.

Cada serviço com `healthcheck` — isso é o que permite ao `docker compose up`
reportar claramente "subiu tudo certo" pra quem não entende de infra.

### 3. `.env.example`
Todas as variáveis necessárias, comentadas em português simples:

```env
# Credenciais da Meta NÃO vão aqui — cada workspace conecta suas contas
# Instagram direto pelo dashboard, em Configurações (RF17).

# Banco de dados (gerado automaticamente, não precisa mudar)
POSTGRES_USER=dmflow
POSTGRES_PASSWORD=troque_esta_senha
POSTGRES_DB=dmflow

# Painel (e-mail que ganha o primeiro workspace — login é por magic-link, sem senha)
DASHBOARD_ADMIN_EMAIL=voce@exemplo.com
RESEND_API_KEY=
```

### 4. Script de setup guiado
`setup.sh` (Linux/Mac) e `setup.ps1` (Windows):
- Verifica se Docker está instalado (senão, mostra link de instalação).
- Copia `.env.example` → `.env` se não existir.
- Roda `docker compose pull` (usa imagem já publicada, não precisa buildar
  local) + `docker compose up -d`.
- No final, imprime: "Acesse http://localhost:3000 — login: (o que está no .env)".

### 5. GitHub Actions — build e publish da imagem
`.github/workflows/release.yml`:
- Dispara em tag `v*.*.*` (ou em cada push na `main`, com tag `:latest`).
- Builda as 3 imagens (backend, worker, frontend).
- Publica em `ghcr.io/ricardosoli777/dmflow-backend`,
  `ghcr.io/ricardosoli777/dmflow-worker`,
  `ghcr.io/ricardosoli777/dmflow-frontend`.
- `docker-compose.yml` de produção referencia essas imagens prontas (`image:
  ghcr.io/...`), então quem clona **não precisa buildar nada** — só puxar.

### 6. README com Quickstart (o que a pessoa leiga vai ler)

```markdown
## Como rodar

1. Instale o Docker Desktop: https://www.docker.com/products/docker-desktop
2. Baixe este repositório (botão verde "Code" → "Download ZIP", ou `git clone`)
3. Abra a pasta e rode:
   - Windows: clique duas vezes em `setup.ps1` (ou rode no PowerShell)
   - Mac/Linux: `./setup.sh`
4. Rode o script de novo — ele sobe tudo com o `.env` só de infraestrutura
5. Acesse http://localhost:3000, faça login e cole suas credenciais do Meta
   em **Configurações** (veja o guia em `docs/04-integracao-meta.md`)
```

### 7. Release versionada
- `CHANGELOG.md` simples por versão.
- Toda wave concluída com Verify passando vira uma tag (`v0.1.0`, `v0.2.0`...)
  — assim sempre existe uma imagem "conhecida boa" pra quem for clonar, em
  vez de depender do estado atual da `main`.

## ⚠️ Deploy em VPS com outros serviços já rodando (Docker Swarm)

Se você for rodar o `infra/docker-stack.yml` numa VPS que **já tem outros
serviços** no mesmo Swarm/rede compartilhada (ex: uma rede `minha-rede`
usada por várias stacks), preste atenção nisso — já mordeu um deploy real
uma vez:

**O problema:** o `backend` e o `frontend` do DMFlow precisam estar na rede
compartilhada (pra o Traefik conseguir rotear `dmflow.example.com` /
`hooks.example.com`). Mas se você nomear o serviço de banco só de
`postgres` (ou `redis`, `minio`), e **qualquer outra stack** naquela mesma
rede também tiver um serviço com esse mesmo nome/alias, o DNS interno do
Docker fica ambíguo — o backend pode acabar se conectando no banco **errado**
(de outra stack!) em vez do seu, e o erro que aparece (`the provided
database credentials ... are not valid`) parece que é senha errada, mas não
é — é conexão no host errado.

**Por isso** o `infra/docker-stack.yml` usa nomes prefixados
(`dmflow-postgres`, `dmflow-redis`, `dmflow-minio`) em vez dos genéricos
`postgres`/`redis`/`minio`. Se for adaptar esse arquivo pra outra VPS com
outras stacks, **mantenha esse prefixo** (ou troque por outro único seu) —
nunca use nomes genéricos de serviço de infra numa rede compartilhada.

O `.env`/`.env.example` na raiz (usado pelo `docker-compose.yml` local, que
não tem esse problema por rodar isolado) continua usando os nomes simples
(`postgres`, `redis`, `minio`) — só o `DATABASE_URL`/`REDIS_URL` usados
dentro do `infra/docker-stack.yml` (via variável de ambiente na VPS)
precisam apontar pro nome prefixado (`@dmflow-postgres:5432`,
`redis://dmflow-redis:6379`).

## ⚠️ Primeira migration commitada (upgrade de instalação já existente)

A migration `20260915120301_workspaces_backfill_default` (parte da wave que
trouxe multi-conta/workspaces — RF16/RF17) faz uma migração de **dados**, não
só de schema: numa instalação que já tinha usuário/contatos/flows antes dela,
cria um workspace "Minha Automação", torna o usuário existente `OWNER` dele,
migra a linha única `settings.instagram_connection` pra virar a primeira
`InstagramAccount`, e move contatos/flows/triggers/links existentes pra
dentro desse workspace. Tudo isso roda **automaticamente** no próximo
`docker stack deploy`/`docker compose up` (é o serviço `migrate`, que já
roda `prisma migrate deploy` antes do backend subir) — não precisa de nenhum
comando manual. Numa instalação nova (banco vazio), essa migration não faz
nada (não existe usuário ainda nesse ponto do boot).

## Por que isso cumpre o objetivo de "outras pessoas sem conhecimento"

- Ninguém precisa instalar Node, Postgres, Redis — só Docker.
- Ninguém precisa buildar nada — a imagem já vem pronta do GHCR.
- Único trabalho manual real é colar as credenciais da Meta em
  **Configurações** dentro do próprio app (inevitável, são credenciais
  pessoais de cada conta Instagram) — e isso é guiado pelo
  `docs/04-integracao-meta.md`.
- `healthcheck` + script de setup dão feedback claro de sucesso/erro sem
  precisar ler logs de container.
