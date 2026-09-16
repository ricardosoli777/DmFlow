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

> ⚠️ **Rodando só no seu computador (`localhost`), o dashboard funciona,
> mas a Meta não consegue mandar eventos reais** (comentário, DM) pra
> `http://localhost:3000` — isso só existe na sua máquina. Pra automação
> funcionar de verdade com o Instagram, o app precisa estar acessível por
> uma URL pública com HTTPS: ou você [faz o deploy numa VPS](#️-deploy-em-produção-vps-própria-docker-swarm),
> ou usa um túnel temporário (ex: `ngrok http 4000`) só pra testar o
> webhook sem publicar nada ainda.

1. Baixe este repositório: botão verde **Code → Download ZIP** (ou
   `git clone https://github.com/ricardosoli777/DmFlow.git` se souber git).
2. Abra a pasta baixada.
3. Rode o script de setup:
   - **Windows:** clique com o botão direito em `setup.ps1` → "Executar com PowerShell".
     Se aparecer um erro tipo *"não é possível carregar o arquivo... a
     execução de scripts foi desabilitada neste sistema"*, abra o
     PowerShell nessa pasta e rode
     `powershell -ExecutionPolicy Bypass -File setup.ps1` em vez de clicar
     duas vezes — é uma proteção padrão do Windows contra scripts
     baixados da internet, não é erro do DMFlow.
   - **Mac/Linux:** abra o terminal na pasta e rode `./setup.sh`
4. Na primeira vez, ele vai criar um arquivo `.env` e parar, pedindo pra
   você preencher. Abra o `.env` num editor de texto simples (Bloco de
   Notas serve) e troque o e-mail do dashboard (`DASHBOARD_ADMIN_EMAIL`) e
   as senhas genéricas de banco/fila (`troque_esta_senha...`) por valores
   seus — **não precisa preencher nenhuma credencial da Meta aqui**, isso é
   feito depois, dentro do próprio app. Login não usa senha (é por link de
   e-mail — ver [`RESEND_API_KEY`](#-login-por-e-mail-sem-senha) abaixo). Gere
   também `META_CREDENTIALS_ENCRYPTION_KEY` com `openssl rand -base64 32`: ela
   cifra as credenciais da Meta antes de gravá-las no banco.
5. Rode o script de novo. Ele vai baixar as imagens prontas e subir tudo.
6. Acesse **http://localhost:3000**, digite o e-mail que você colocou em
   `DASHBOARD_ADMIN_EMAIL` — sem `RESEND_API_KEY` configurada, o link de
   login aparece no log do container `backend` (`docker compose logs -f
   backend`) em vez de chegar por e-mail de verdade. Depois de entrar, vá em
   **Configurações** (`/settings`) pra colar as credenciais da sua conta
   Meta/Instagram (veja onde pegar cada uma logo abaixo). Elas ficam
   guardadas no banco de dados do próprio app — cada pessoa que for rodar o
   DMFlow usa as suas, sem editar arquivo nenhum.

### 🔑 Login por e-mail (sem senha)

O DMFlow não usa senha — o login é sempre um link de uso único mandado por
e-mail (expira em 15 minutos). Suporta múltiplas pessoas: quem tem acesso ao
workspace pode convidar outras em **Time** (`/settings/team`) — cada convite
vira um link pra copiar e mandar, sem precisar configurar nada a mais.

Isso é configuração **de infraestrutura, feita uma vez só por quem hospeda**
(mora no `.env`) — não é algo que cada pessoa que faz login precisa
configurar. Sem nenhuma das opções abaixo preenchida, o link só aparece no
log do backend (`docker compose logs -f backend` / `docker service logs
dmflow_backend`) em vez de chegar por e-mail de verdade — funciona pra
testar, mas ninguém mais consegue entrar sozinho.

**Opção 1 — Resend** (recomendado: melhor entrega, mas exige domínio verificado)

1. Crie uma conta grátis em [resend.com](https://resend.com/signup) (plano
   free: 3.000 e-mails/mês).
2. **Domains → Add Domain** → digite o domínio que você quer usar como
   remetente (o mesmo do `EMAIL_FROM` no `.env`).
3. Copie os registros DNS que a Resend mostrar (geralmente 1 MX + 1-2 TXT
   de SPF/DKIM) e cadastre no painel onde esse domínio está registrado.
4. Volte em **Domains** e clique **Verify DNS Records** (propagação pode
   levar de minutos a horas).
5. **API Keys → Create API Key** (permissão "Sending access" basta) — copie
   a chave, ela só aparece uma vez.
6. Cole em `RESEND_API_KEY` no `.env` e reinicie o backend.

**Opção 2 — Gmail com senha de app** (sem domínio, mais simples de começar,
mas limite de ~500 e-mails/dia e mais chance de cair em spam — melhor pra
uso pessoal/poucos workspaces)

1. Ative a **verificação em duas etapas** na sua conta Google, se ainda não
   tiver: [myaccount.google.com/security](https://myaccount.google.com/security).
2. Acesse [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   (só aparece com a verificação em duas etapas ativa).
3. Dê um nome (ex: "DMFlow") e clique **Criar**. O Google mostra uma senha
   de 16 letras — copie ela (não é a senha da sua conta, é uma senha só
   pra esse uso).
4. No `.env`: `GMAIL_USER=seuemail@gmail.com` e
   `GMAIL_APP_PASSWORD=` (cole a senha de 16 letras, sem espaços).
5. Preencha também `EMAIL_FROM` (pode ser o mesmo `GMAIL_USER`).
6. Reinicie o backend.

Se preencher as duas opções, o DMFlow usa a Resend primeiro.

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
| **Token de acesso da página** | Graph API Explorer → `GET /me/accounts?fields=id,name,access_token,instagram_business_account` → copie o `access_token` da Página vinculada (não o token de usuário) |
| **ID da conta Instagram** | **Ferramentas → Graph API Explorer** → `GET /me/accounts?fields=instagram_business_account` |
| **Token de verificação do webhook** | Você mesmo inventa (senha aleatória) — usa o mesmo valor ao configurar o Webhook no app |

> Importante: o **Page Access Token** é o `access_token` dentro do objeto da
> Página retornado por `/me/accounts`. O DMFlow valida o token antes de salvar
> e o armazena cifrado. O token direto do Graph API Explorer serve para teste;
> em produção use um User Token de longa duração, gere novamente o Page Token
> e renove-o quando expirar. Se a Meta retornar erro 190, gere/estenda o token
> e confirme que ele pertence à Página ligada ao Instagram. O passo a passo
> completo está em [`docs/04-integracao-meta.md`](docs/04-integracao-meta.md).

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
- ✅ **Wave 2 — Meta conectada e webhook validado em produção:** app da Meta
  configurado, conta Instagram conectada e verificada via Graph API (visível
  em `/settings`), webhook confirmado pela Meta (handshake `hub.challenge`
  respondido com sucesso). Falta só testar um comentário real ponta a ponta.
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
  - Pendente: upload de mídia por arrastar-e-soltar (hoje é só URL), edição
    de texto inline no canvas
- ✅ **Wave 6 — no ar em produção:** https://dmflow.example.com
  (dashboard) e https://hooks.example.com (API/webhook), rodando via
  Docker Swarm numa VPS própria
- ✅ **Wave 7 — hardening e recursos avançados** (RF13-RF15, RNF08-RNF09):
  filtro de auto-comentário, `messages_log` com status/motivo estruturado,
  Inbox com envio manual de verdade (thread completa em `/inbox`), node
  "Aguardar" com agendamento real (fila `flow-resume`), rate limiting contra
  o cap de 750 envios/h da Meta, links rastreados com CTR (`/links`), e
  follow gate opcional em botão de CTA
- ✅ **Wave 8 — multi-tenant** (RF16, RF17, RNF10): workspaces com papéis
  (owner/admin/member) e convite por link (`/settings/team`), múltiplas
  contas Instagram por workspace (`/settings`), login sem senha por
  magic-link

Ver [`docs/07-plano-waves-spec-driven.md`](docs/07-plano-waves-spec-driven.md)
pro estado detalhado de cada etapa.
