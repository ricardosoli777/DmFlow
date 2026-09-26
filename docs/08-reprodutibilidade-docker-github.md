# 08 — Instalação reproduzível

Este guia descreve dois caminhos. **Docker Compose local** é o caminho para
começar: compila as imagens no computador de quem instala e usa
`http://localhost:3000`. **Docker Swarm + Traefik** é um exemplo avançado
para quem já administra uma VPS, um domínio e um proxy HTTPS. Nenhuma
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
4. Gere `JWT_SECRET` e `META_CREDENTIALS_ENCRYPTION_KEY`. Ambos precisam
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

Este caminho pressupõe Docker Swarm ativo, Traefik funcionando com uma rede
overlay externa, dois nomes DNS seus apontando para a VPS e certificados
HTTPS. Não use o `docker-compose.yml` local como stack Swarm: ele compila
imagens localmente, enquanto `infra/docker-stack.yml` consome imagens
publicadas no registro do seu repositório.

1. Publique o projeto em um repositório seu. O workflow
   [release.yml](../.github/workflows/release.yml) produz as imagens
   `dmflow-backend`, `dmflow-worker` e `dmflow-frontend` no namespace
   GHCR desse repositório, com tag `sha-<commit-curto>`.
2. Nas configurações do repositório, crie o secret
   `DMFLOW_PUBLIC_API_URL` com a URL HTTPS pública da sua API, sem barra
   final. O frontend precisa desse valor **durante o build**. Quem fizer um
   fork precisa configurar o próprio secret antes de publicar imagens.
3. Na VPS, clone seu repositório e crie `.env` a partir de
   `.env.example`. Gere os segredos como no passo local. Use URLs HTTPS
   próprias em `PUBLIC_APP_URL` e `PUBLIC_API_URL`, sem barra final.
   Ajuste `DATABASE_URL` para o hostname `dmflow-postgres` (não
   `postgres`), mantendo a mesma senha de `POSTGRES_PASSWORD`.
4. Preencha `DMFLOW_IMAGE_REPOSITORY` com o namespace do seu registro
   (formato `ghcr.io/SEU_USUARIO`). Preencha `TRAEFIK_NETWORK` com o nome
   da rede overlay externa conectada ao Traefik,
   `TRAEFIK_ENTRYPOINT` e `TRAEFIK_CERTRESOLVER` com os nomes usados
   pela sua configuração do Traefik. Confira que a rede existe com
   `docker network ls`. Se as imagens GHCR forem privadas, autentique o
   Docker no registro antes do deploy.
5. Configure um provedor de e-mail real. Sem ele, os links de cadastro e
   login só aparecerão nos logs do backend da VPS, o que não serve para
   usuários externos. Confira que o remetente em `EMAIL_FROM` pertence
   ao provedor configurado.
6. Depois de o workflow publicar as imagens, execute na pasta do projeto:

   ```bash
   bash infra/deploy.sh sha-SEU_COMMIT_CURTO
   docker service ls
   docker service logs --tail 30 dmflow_migrate
   ```

O script carrega o `.env`, valida variáveis obrigatórias e aplica a stack.
O serviço `dmflow_migrate` roda uma vez e pode aparecer como `0/1`
após concluir; confirme nos logs que as migrations terminaram sem erro.
Verifique a rota `/health` da API e as páginas `/register` e `/login`
do painel nos **seus** domínios. Cadastre o webhook da Meta com
`<PUBLIC_API_URL>/webhooks/instagram`.

Antes de atualizar uma instalação com dados, faça backup do banco e dos
volumes conforme a política da sua VPS. O script não cria backup.

## Notas de arquitetura

- O Compose da raiz cria Postgres, Redis e MinIO próprios. No Swarm os
  serviços de infraestrutura usam nomes prefixados para evitar colisão de
  DNS com outras stacks.
- `docker stack deploy` não lê `.env` automaticamente; o script
  `infra/deploy.sh` carrega o arquivo antes do comando.
- A URL pública da API é embutida no JavaScript do navegador. Ela precisa
  ser alcançável pelos usuários e não deve conter credenciais.
- O repositório não contém credenciais ou domínios de uma instalação real.
