# 08 — Instalação reproduzível

Este guia descreve dois caminhos. **Docker Compose local** é o caminho para
começar: compila as imagens no computador de quem instala e usa
`http://localhost:3000`. **Docker Swarm + Traefik** instala o projeto em
uma VPS Linux de um nó, com domínio e HTTPS. Nenhuma
credencial, domínio ou IP da instalação original é necessária.

## 1. Instalação local com Docker Compose

### Pré-requisitos

- Docker Desktop iniciado (Windows/macOS) ou Docker Engine com o plugin
  Compose v2 (Linux). Confirme com `docker compose version` e `docker info`.
- Portas 3000 e 4000 disponíveis. O Compose também publica a porta 9001 do
  console MinIO; altere o mapeamento no `docker-compose.yml` se ela já estiver
  em uso.
- Acesso à internet para baixar as imagens base e dependências na primeira
  compilação. Node.js e PostgreSQL não precisam ser instalados no host.

### Preparar o `.env`

1. Baixe o código pela opção **Code → Download ZIP** da página do repositório,
   extraia o ZIP e abra um terminal na pasta que contém
   `docker-compose.yml`. Quem usa Git pode clonar a URL mostrada em **Code**.
2. Execute `powershell -ExecutionPolicy Bypass -File .\setup.ps1` no Windows
   ou `bash setup.sh` no macOS/Linux. Na primeira execução o script cria
   `.env` e para para você preenchê-lo.
3. Abra `.env` e substitua `POSTGRES_PASSWORD` por uma senha longa de
   letras e números. Substitua **o mesmo texto** da senha dentro de
   `DATABASE_URL`. Exemplo de formato:
   `DATABASE_URL=postgresql://dmflow:SUA_SENHA@postgres:5432/dmflow`.
   Use letras e números para não precisar codificar caracteres reservados na
   URL.
4. Troque `MINIO_ROOT_PASSWORD` por outra senha longa. Gere `JWT_SECRET`
   e `META_CREDENTIALS_ENCRYPTION_KEY`. Os dois segredos precisam
   ser diferentes. No macOS/Linux, rode `openssl rand -base64 32` duas vezes
   e cole cada resultado em uma variável. No PowerShell, rode o bloco abaixo
   duas vezes:

   ```powershell
   $bytes = New-Object byte[] 32
   [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
   [Convert]::ToBase64String($bytes)
   ```

5. Para a primeira conta, deixe `DASHBOARD_ADMIN_EMAIL` vazio e use
   **Criar conta** no aplicativo. Se preencher essa variável com seu próprio
   e-mail antes da primeira subida, o seed cria a conta e um workspace;
   nesse caso use **Entrar**, não **Criar conta**.
6. Para teste local, pode deixar `RESEND_API_KEY`, `GMAIL_USER` e
   `GMAIL_APP_PASSWORD` vazios. O backend imprimirá o link de confirmação
   nos logs. Para enviar e-mails reais, configure um provedor conforme
   [README](../README.md#envio-dos-links-por-e-mail).

Mantenha `PUBLIC_APP_URL=http://localhost:3000`,
`PUBLIC_API_URL=http://localhost:4000` e
`NEXT_PUBLIC_API_URL=http://localhost:4000` na instalação local. O
`NEXT_PUBLIC_API_URL` entra no bundle do frontend durante a compilação:
se mudar essa variável, reconstrua a imagem.

O arquivo `.env` contém segredos, já está ignorado pelo Git e não deve ser
enviado a terceiros. `.env.example` contém apenas exemplos.

### Subir e conferir

Rode o mesmo script de setup novamente. Ele valida a configuração do Compose
e executa `docker compose up --build -d`. O primeiro build pode demorar.
Em seguida:

```bash
docker compose ps
docker compose logs migrate
docker compose logs backend
```

O serviço `migrate` deve terminar com código 0. Backend, worker e frontend
devem estar em execução. Abra `http://localhost:3000/register`, informe seu
e-mail e confirme pelo link recebido. Sem provedor configurado, copie o link
impresso em `docker compose logs backend`. Ele expira em 15 minutos e pode
ser usado uma vez. Depois do cadastro, use `/login` com o mesmo e-mail.

Se configurou `DASHBOARD_ADMIN_EMAIL`, a conta já existe: comece em
`http://localhost:3000/login` e use esse e-mail. Tentar cadastrá-lo
novamente mostrará que ele já tem conta.

O painel pode abrir em localhost sem integração com a Meta. Para receber
webhooks reais, a API precisa estar acessível por HTTPS público; localhost
sozinho não recebe chamadas da Meta. Veja
[integração com Meta](04-integracao-meta.md).

### Atualizar, parar e diagnosticar

```bash
docker compose up --build -d
docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
docker compose logs --tail=100 migrate
docker compose down
```

`docker compose down` para os containers e preserva os volumes de dados.
Não use `docker compose down -v` se quiser manter banco, Redis e mídias.
Se a página abrir, mas a API não responder, confirme
`NEXT_PUBLIC_API_URL` e reconstrua o frontend. Se o banco recusar a
conexão, confira se a senha em `POSTGRES_PASSWORD` corresponde à senha
dentro de `DATABASE_URL`. Se a senha do Postgres for alterada após o
primeiro boot, o volume existente continuará com a senha anterior: use a
senha original ou faça uma migração de senha no banco.

## 2. VPS própria com Docker Swarm e Traefik

Este roteiro serve para **uma VPS Linux de um nó**, com domínio próprio e
acesso SSH. Os comandos abaixo rodam na VPS, exceto a configuração do GitHub
e do DNS. Use, por exemplo, `app.seudominio.com` para o painel e
`api.seudominio.com` para a API. Substitua esses nomes e `SEU_USUARIO`
pelos seus valores. Para um Swarm de vários nós, planeje separadamente
volumes persistentes e portas entre nós.

### Passo 1 — Prepare VPS, Docker e DNS

1. Crie dois registros **A** no provedor de DNS, ambos apontando para o IP
   público IPv4 da VPS. Se usar IPv6, crie registros AAAA apenas quando ele
   também alcançar a VPS. Aguarde os nomes resolverem para o IP correto.
2. Libere entrada TCP nas portas **80** e **443** no firewall da VPS e do
   provedor. Mantenha acesso SSH. A porta 80 é necessária para o desafio
   HTTP da Let's Encrypt. Não exponha Postgres, Redis, MinIO ou a porta
   4000 diretamente à internet.
3. Instale Git e OpenSSL pelo gerenciador de pacotes do seu Linux. Em uma
   VPS **Ubuntu LTS nova**, instale o Docker Engine pelo repositório oficial:

   ```bash
   sudo apt update
   sudo apt install -y git openssl ca-certificates curl
   sudo install -m 0755 -d /etc/apt/keyrings
   sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
   sudo chmod a+r /etc/apt/keyrings/docker.asc
   sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<EOF
   Types: deb
   URIs: https://download.docker.com/linux/ubuntu
   Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
   Components: stable
   Architectures: $(dpkg --print-architecture)
   Signed-By: /etc/apt/keyrings/docker.asc
   EOF
   sudo apt update
   sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   ```

   Em Debian ou outra distribuição, siga o
   [guia oficial correspondente](https://docs.docker.com/engine/install/).
   Em uma VPS que já usa Docker, confira a instalação existente antes de
   adicionar o repositório. Confirme:

   ```bash
   git --version
   openssl version
   docker version
   docker info
   ```

   Se o seu usuário não tiver acesso ao daemon, use uma sessão com acesso
   administrativo para os comandos Docker. Para uma VPS nova de um único
   endereço, inicie o Swarm e crie a rede do proxy:

   ```bash
   docker swarm init
   docker network create --driver overlay --attachable dmflow_proxy
   docker network ls
   ```

   Se o Swarm já estiver ativo, pule `swarm init`; se já usar Traefik,
   use a rede overlay dele no passo 3. Em VPS com várias interfaces, passe
   `--advertise-addr IP_DA_INTERFACE` ao inicializar o Swarm.

### Passo 2 — Publique as imagens do seu repositório

1. Faça fork ou publique o código em um repositório GitHub sob sua conta.
   Se o GitHub pedir para habilitar Actions no fork, habilite-as.
   Em **Settings → Secrets and variables → Actions**, crie o secret
   `DMFLOW_PUBLIC_API_URL` com `https://api.seudominio.com`, sem barra
   final. Ele entra no JavaScript do frontend **durante o build**.
2. Envie um commit à branch `main` ou crie uma tag `vX.Y.Z`. Em
   **Actions → Release**, aguarde os três builds terminarem com sucesso.
   O [workflow](../.github/workflows/release.yml) publica
   `dmflow-backend`, `dmflow-worker` e `dmflow-frontend` no GHCR com
   a mesma tag `sha-<7 caracteres do commit>`.
3. Em **Packages** no GitHub, deixe os três pacotes públicos para o
   primeiro deploy. Se quiser mantê-los privados, autentique o Docker
   da VPS no `ghcr.io` com um token que tenha `read:packages` antes
   do deploy. O script usa `--with-registry-auth` para repassar essa
   autenticação ao Swarm.

### Passo 3 — Clone e configure o `.env` na VPS

```bash
git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git dmflow
cd dmflow
cp .env.example .env
chmod 600 .env
```

Edite `.env` e confira esta lista. Use **letras e números** nas senhas
colocadas em `DATABASE_URL` para evitar codificação especial de URL.
Não coloque espaços antes ou depois de `=`.

| Variável | Valor na VPS |
|---|---|
| `POSTGRES_PASSWORD` | Senha longa e exclusiva, diferente do exemplo. |
| `DATABASE_URL` | `postgresql://dmflow:SUA_SENHA@dmflow-postgres:5432/dmflow`, com a mesma senha acima. |
| `MINIO_ROOT_PASSWORD` | Outra senha longa, diferente do exemplo. |
| `JWT_SECRET` | Resultado de `openssl rand -base64 32`. |
| `META_CREDENTIALS_ENCRYPTION_KEY` | Outro resultado de `openssl rand -base64 32`. Preserve esta chave para conseguir ler as credenciais já cifradas. |
| `PUBLIC_APP_URL` | `https://app.seudominio.com`, sem barra final. |
| `PUBLIC_API_URL` | `https://api.seudominio.com`, sem barra final. Deve ser igual ao secret do build. |
| `DMFLOW_IMAGE_REPOSITORY` | `ghcr.io/seu_usuario` em minúsculas, sem barra final. |
| `TRAEFIK_NETWORK` | `dmflow_proxy` para o exemplo abaixo. |
| `TRAEFIK_ENTRYPOINT` | `websecure` para o exemplo abaixo. |
| `TRAEFIK_CERTRESOLVER` | `letsencrypt` para o exemplo abaixo. |
| `TRAEFIK_ACME_EMAIL` | Seu e-mail para os avisos da Let's Encrypt; usado só pelo proxy de exemplo. |

Deixe `POSTGRES_USER=dmflow` e `POSTGRES_DB=dmflow`. Para criar a
primeira conta pelo painel, deixe `DASHBOARD_ADMIN_EMAIL` vazio. Se
preencher com seu e-mail **antes do primeiro deploy**, o seed criará a
conta e o workspace; nesse caso comece em `/login`. Configure **Resend**
ou **Gmail** e um `EMAIL_FROM` autorizado, conforme
[envio dos links](../README.md#envio-dos-links-por-e-mail). Sem isso, os
links de acesso só aparecem nos logs da VPS. `NEXT_PUBLIC_API_URL` do
`.env` não recompila uma imagem do GHCR: para mudar a API pública,
atualize o secret do GitHub, publique novas imagens e redeploye.

### Passo 4 — Suba o proxy HTTPS

Se já existe Traefik com provider **Swarm**, rede overlay, entrada HTTPS
e emissor de certificados, use os nomes reais dessa instalação nas
variáveis `TRAEFIK_*` e pule o comando abaixo. Para a VPS nova, o
[proxy de exemplo](../infra/traefik-stack.yml) usa os nomes da tabela.
Ele segue o [provider Swarm](https://doc.traefik.io/traefik/v3.5/reference/install-configuration/providers/swarm/)
e o [desafio HTTP ACME](https://doc.traefik.io/traefik/v3.5/reference/install-configuration/tls/certificate-resolvers/acme/)
do Traefik.
Carregue o `.env` no shell e suba-o:

```bash
set -a
source .env
set +a
test -n "$TRAEFIK_ACME_EMAIL"
docker stack deploy -c infra/traefik-stack.yml traefik
docker service ls
docker service logs --tail 50 traefik_traefik
```

Confirme que `traefik_traefik` está `1/1`. O proxy guarda os certificados
no volume `traefik_traefik_acme`; preserve esse volume nos backups. O
proxy tem acesso de leitura ao socket Docker para descobrir os serviços,
portanto administre esta VPS e seus serviços Docker como infraestrutura
confiável.

### Passo 5 — Aplique a stack do DMFlow

Confira no GitHub o commit publicado e substitua a tag abaixo. Se a VPS
estiver exatamente nesse commit, `git rev-parse --short=7 HEAD` mostra os
sete caracteres. Depois:

```bash
bash infra/deploy.sh sha-SEU_COMMIT_CURTO
docker service ls
docker service logs --tail 50 dmflow_migrate
docker service logs --tail 50 dmflow_backend
```

O script carrega `.env` e aplica `infra/docker-stack.yml`. A migração
roda uma vez; `dmflow_migrate` pode aparecer `0/1` depois de concluir.
Os logs devem mostrar migrações e seed sem erro. Backend, worker e frontend
devem ficar `1/1`; se algum estiver `0/1`, veja
`docker service ps dmflow_NOME --no-trunc` e
`docker service logs dmflow_NOME`.

Confira `https://api.seudominio.com/health` no navegador ou com
`curl -i https://api.seudominio.com/health`. Depois abra
`https://app.seudominio.com/register` e `/login`. Cadastre o webhook
da Meta em `https://api.seudominio.com/webhooks/instagram` conforme o
[guia de integração](04-integracao-meta.md). O painel pode ser validado
antes de conectar a Meta.

### Atualizações e dados

Ao atualizar, faça backup do banco e dos volumes antes de trocar a tag.
Publique o novo commit na `main`, confirme os três builds no GitHub,
atualize o clone da VPS para esse commit e rode
`bash infra/deploy.sh sha-NOVO_COMMIT_CURTO`. O script não cria backup.
Não execute `docker stack rm dmflow` para fazer uma atualização normal.

## Notas de arquitetura

- O Compose da raiz cria Postgres, Redis e MinIO próprios. No Swarm os
  serviços de infraestrutura usam nomes prefixados para evitar colisão de
  DNS com outras stacks.
- `docker stack deploy` não lê `.env` automaticamente; o script
  `infra/deploy.sh` carrega o arquivo antes do comando.
- A URL pública da API é embutida no JavaScript do navegador. Ela precisa
  ser alcançável pelos usuários e não deve conter credenciais.
- O repositório não contém credenciais ou domínios de uma instalação real.
