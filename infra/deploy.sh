#!/usr/bin/env bash
set -euo pipefail

image_tag="${1:?Uso: bash infra/deploy.sh sha-<commit>}"
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

if [[ ! -f .env ]]; then
  echo "Arquivo .env não encontrado em $repo_dir" >&2
  exit 1
fi

set -a
# Docker stack deploy não carrega .env automaticamente.
source .env
set +a

for name in DATABASE_URL JWT_SECRET META_CREDENTIALS_ENCRYPTION_KEY POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB MINIO_ROOT_USER MINIO_ROOT_PASSWORD DMFLOW_IMAGE_REPOSITORY PUBLIC_APP_URL PUBLIC_API_URL TRAEFIK_NETWORK TRAEFIK_ENTRYPOINT TRAEFIK_CERTRESOLVER; do
  if [[ -z "${!name:-}" || "${!name}" == *troque_* ]]; then
    echo "Preencha $name com um valor real no .env antes do deploy." >&2
    exit 1
  fi
done

if [[ ! "$PUBLIC_APP_URL" =~ ^https://[^/]+$ || ! "$PUBLIC_API_URL" =~ ^https://[^/]+$ ]]; then
  echo "PUBLIC_APP_URL e PUBLIC_API_URL devem ser URLs HTTPS sem barra final." >&2
  exit 1
fi
export DMFLOW_APP_HOST="${PUBLIC_APP_URL#https://}"
export DMFLOW_API_HOST="${PUBLIC_API_URL#https://}"

export DMFLOW_IMAGE_TAG="$image_tag"
docker stack deploy --with-registry-auth -c infra/docker-stack.yml dmflow
