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

for name in DATABASE_URL JWT_SECRET META_CREDENTIALS_ENCRYPTION_KEY POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB MINIO_ROOT_USER MINIO_ROOT_PASSWORD; do
  if [[ -z "${!name:-}" ]]; then
    echo "Variável obrigatória ausente: $name" >&2
    exit 1
  fi
done

export DMFLOW_IMAGE_TAG="$image_tag"
docker stack deploy --with-registry-auth -c infra/docker-stack.yml dmflow
