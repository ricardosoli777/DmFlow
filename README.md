<p align="center">
  <img src="docs/assets/readme-banner.svg" alt="DMFlow: automação inteligente para conversas no Instagram" width="100%" />
</p>

# DMFlow

Painel de automação de mensagens do Instagram com editor visual de fluxos,
gatilhos para comentários, inbox e workspaces. O projeto usa Docker Compose
para instalação local. Para receber eventos reais da Meta, a API precisa de
uma URL pública HTTPS.

## Instalação local: primeiro acesso

### 1. Instale e inicie o Docker

Instale o [Docker Desktop](https://docs.docker.com/desktop/) no Windows/macOS
ou Docker Engine com o plugin Compose no Linux. Confirme no terminal:

```bash
docker compose version
docker info
```

Deixe livres as portas **3000** (painel) e **4000** (API). O Compose também
publica a porta **9001** do console MinIO. Na primeira instalação será
necessário acesso à internet para baixar dependências e compilar as imagens.

### 2. Baixe o projeto e crie o `.env`

Na página do repositório, use **Code → Download ZIP**, extraia o arquivo e
abra um terminal na pasta onde está `docker-compose.yml`. Se usa Git, copie
a URL exibida em **Code** e clone o repositório.

Execute o script do seu sistema **uma vez**. Ele cria `.env` e para:

```powershell
# Windows, no PowerShell aberto na pasta do projeto
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

```bash
# macOS ou Linux, no terminal aberto na pasta do projeto
bash setup.sh
```

Abra o novo arquivo `.env` e preencha:

| Variável | O que fazer |
|---|---|
| `POSTGRES_PASSWORD` | Troque o valor de exemplo por uma senha longa de letras e números. |
| `DATABASE_URL` | Troque a senha dentro da URL pela **mesma** senha de `POSTGRES_PASSWORD`; mantenha `@postgres:5432/dmflow` no Compose local. |
| `MINIO_ROOT_PASSWORD` | Troque o valor de exemplo por outra senha longa; ela protege o armazenamento de mídia. |
| `JWT_SECRET` | Gere uma string aleatória longa. |
| `META_CREDENTIALS_ENCRYPTION_KEY` | Gere outra chave aleatória Base64 de 32 bytes; não reutilize o JWT secret. |

Para gerar as duas chaves, no macOS/Linux rode `openssl rand -base64 32`
duas vezes. No PowerShell, rode este bloco duas vezes e copie cada resultado
para uma variável:

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

Deixe `DASHBOARD_ADMIN_EMAIL` vazio para criar a primeira conta pelo
cadastro. Mantenha as três URLs locais do exemplo (`PUBLIC_APP_URL`,
`PUBLIC_API_URL`, `NEXT_PUBLIC_API_URL`) como `localhost`. As credenciais
da Meta são configuradas depois no painel, não no `.env`.

O arquivo `.env` contém segredos e está ignorado pelo Git. Não o compartilhe
nem o envie ao repositório.

### 3. Suba o aplicativo

Rode **o mesmo script novamente**. Ele valida o Compose, compila as imagens
para a sua instalação e sobe os containers. Não é necessário instalar
Node.js, PostgreSQL ou Redis no computador.

Quando terminar, confira:

```bash
docker compose ps
docker compose logs migrate
```

O serviço `migrate` deve terminar com código 0. Backend, worker e frontend
devem ficar em execução. Abra **http://localhost:3000/register**, informe
seu e-mail e clique no link de confirmação. Depois use
**http://localhost:3000/login** para entrar.

Sem provedor de e-mail configurado, o link aparece no log local:

```bash
docker compose logs backend
```

Copie a URL `/login/verify?token=...` do log e abra no navegador. Cada
link expira em 15 minutos e só funciona uma vez. Se você definiu
`DASHBOARD_ADMIN_EMAIL` antes de subir o projeto, o seed já criou essa
conta e um workspace: comece em `/login` com esse e-mail.

## Envio dos links por e-mail

O cadastro e o login são separados e não usam senha. A pessoa sem conta
entra em `/register`, confirma o e-mail e só então pode usar `/login`.
Convites de workspace também permitem cadastrar quem ainda não tem conta.

No computador local, deixar o provedor vazio é útil para testar: o backend
imprime os links no log. Para outras pessoas acessarem a instalação, configure
**uma** opção no `.env`:

1. **Resend:** verifique um domínio/remetente na sua conta Resend, crie uma
   chave de envio e preencha `RESEND_API_KEY` e `EMAIL_FROM` com o remetente
   autorizado.
2. **Gmail:** use uma conta com senha de aplicativo habilitada; preencha
   `GMAIL_USER`, `GMAIL_APP_PASSWORD` e `EMAIL_FROM` com o remetente
   aceito pela conta.

Se ambas estiverem preenchidas, o backend usa Resend. Depois de alterar
`.env`, recrie o backend com `docker compose up -d --force-recreate backend`.
Confira `docker compose logs backend` se o e-mail não chegar. Não publique
links de login: eles concedem acesso à conta enquanto estiverem válidos.

## Conectar o Instagram

Abra **Configurações** no painel e adicione uma conta Instagram. O aplicativo
aceita conexão por credenciais da Meta ou pela integração Zernio, quando
configurada. Para o caminho manual da Meta, prepare uma conta profissional,
um app da Meta e os dados solicitados nos campos do painel. O
[guia de integração](docs/04-integracao-meta.md) mostra onde localizar cada
valor e como configurar o webhook.

O painel funciona em `localhost`, mas a Meta não consegue enviar eventos
para o endereço local do seu computador. Para comentários e DMs reais,
publique a API em HTTPS e configure o callback
`<URL_PUBLICA_DA_API>/webhooks/instagram` no seu app da Meta.

## Atualizar e resolver problemas

```bash
docker compose up --build -d       # recompila e atualiza
docker compose ps                 # estado dos serviços
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
docker compose logs --tail=100 migrate
docker compose down               # para sem apagar os volumes
```

- **Banco não conecta:** a senha em `DATABASE_URL` deve ser igual a
  `POSTGRES_PASSWORD`. Se o banco já foi iniciado com outra senha, o volume
  preserva a senha anterior.
- **Cadastro ou login não envia e-mail:** confira o provedor, `EMAIL_FROM`
  e o log do backend. Sem provedor, o link só é impresso no log.
- **Tela abre, API não responde:** confira `NEXT_PUBLIC_API_URL`. Esse
  endereço é gravado no frontend no build; depois de mudá-lo, rode
  `docker compose up --build -d frontend`.
- **Porta ocupada:** altere o mapeamento da porta no `docker-compose.yml`
  ou libere a porta e suba novamente.

Para manter seus dados, **não** use `docker compose down -v`: a opção
`-v` remove os volumes do banco, Redis e MinIO.

## Instalação em VPS

O [guia de instalação reproduzível](docs/08-reprodutibilidade-docker-github.md#2-vps-própria-com-docker-swarm-e-traefik)
traz o roteiro completo para uma VPS Linux: Docker, DNS, Swarm, Traefik,
imagens no GHCR, `.env`, deploy e verificação. Separe um domínio para o
painel e outro para a API; nenhum endereço de outra instalação é necessário.

## Estrutura e documentação

| Pasta | Função |
|---|---|
| `backend/` | API Fastify, autenticação e webhooks |
| `worker/` | Processamento de eventos e fluxos |
| `frontend/` | Painel Next.js |
| `packages/db/` | Schema Prisma e migrações |
| `infra/` | Exemplo de deploy Docker Swarm |

- [Visão geral](docs/01-visao-geral.md)
- [Arquitetura](docs/02-arquitetura.md)
- [Motor de fluxos](docs/03-motor-de-fluxos.md)
- [Integração Meta/Instagram](docs/04-integracao-meta.md)
- [Dashboard](docs/05-dashboard.md)
- [Roadmap](docs/06-roadmap.md)
- [Plano de execução](docs/07-plano-waves-spec-driven.md)
- [Instalação reproduzível e VPS](docs/08-reprodutibilidade-docker-github.md)
- [Design system](docs/09-design-system.md)
- [Requisitos](PROJECT-SPEC.md)
