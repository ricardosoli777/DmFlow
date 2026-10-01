#!/usr/bin/env bash
# Instalação local: compila as imagens com as URLs definidas neste .env.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker não encontrado. Instale Docker Engine/Desktop: https://docs.docker.com/get-docker/" >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 não encontrado. Instale/atualize o Docker com o plugin Compose." >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "Docker não está iniciado. Abra o Docker Desktop ou inicie o serviço Docker." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Arquivo .env criado. Edite POSTGRES_PASSWORD e a senha dentro de DATABASE_URL"
  echo "com o mesmo valor. Troque MINIO_ROOT_PASSWORD e preencha JWT_SECRET"
  echo "e META_CREDENTIALS_ENCRYPTION_KEY."
  echo "Veja os comandos de geração no README. Depois rode este script novamente."
  exit 0
fi

env_value() { sed -n "s/^$1=//p" .env | tail -n 1; }
for name in POSTGRES_PASSWORD DATABASE_URL MINIO_ROOT_PASSWORD JWT_SECRET META_CREDENTIALS_ENCRYPTION_KEY; do
  value="$(env_value "$name")"
  if [[ -z "$value" || "$value" == *troque_* ]]; then
    echo "Preencha $name no .env antes de continuar (veja o README)." >&2
    exit 1
  fi
done

docker compose config --quiet
docker compose up --build -d
docker compose ps
echo "Acesse http://localhost:3000/register para criar a primeira conta."
echo "Se definiu DASHBOARD_ADMIN_EMAIL, use http://localhost:3000/login com esse e-mail."
echo "Sem provedor de e-mail, o link de confirmação aparece em: docker compose logs backend"
