#!/usr/bin/env bash
# Setup guiado do DMFlow — ver docs/08-reprodutibilidade-docker-github.md
set -e

if ! command -v docker &> /dev/null; then
  echo "Docker não encontrado. Instale em: https://www.docker.com/products/docker-desktop"
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "Criei o arquivo .env a partir do .env.example."
  echo "Abra o .env e troque o e-mail/senha do dashboard (DASHBOARD_ADMIN_EMAIL/"
  echo "DASHBOARD_ADMIN_PASSWORD) e as senhas genéricas de banco/fila. Não precisa"
  echo "preencher nada da Meta aqui — isso é feito depois, dentro do app, em"
  echo "Configurações (veja docs/04-integracao-meta.md). Depois rode este script de novo."
  exit 0
fi

echo "Subindo o DMFlow..."
docker compose pull
docker compose up -d

echo ""
echo "Pronto! Acesse http://localhost:3000"
echo "Login: o e-mail/senha definidos em DASHBOARD_ADMIN_EMAIL / DASHBOARD_ADMIN_PASSWORD no .env"
