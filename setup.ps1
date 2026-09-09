# Setup guiado do DMFlow — ver docs/08-reprodutibilidade-docker-github.md

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker nao encontrado. Instale em: https://www.docker.com/products/docker-desktop"
    exit 1
}

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host ""
    Write-Host "Criei o arquivo .env a partir do .env.example."
    Write-Host "Abra o .env e troque o e-mail/senha do dashboard (DASHBOARD_ADMIN_EMAIL/"
    Write-Host "DASHBOARD_ADMIN_PASSWORD) e as senhas genericas de banco/fila. Nao precisa"
    Write-Host "preencher nada da Meta aqui -- isso e feito depois, dentro do app, em"
    Write-Host "Configuracoes (veja docs/04-integracao-meta.md). Depois rode este script de novo."
    exit 0
}

Write-Host "Subindo o DMFlow..."
docker compose pull
docker compose up -d

Write-Host ""
Write-Host "Pronto! Acesse http://localhost:3000"
Write-Host "Login: o e-mail/senha definidos em DASHBOARD_ADMIN_EMAIL / DASHBOARD_ADMIN_PASSWORD no .env"
