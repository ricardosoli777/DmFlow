# Instalação local: compila as imagens com as URLs definidas neste .env.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error 'Docker não encontrado. Instale Docker Desktop: https://docs.docker.com/desktop/'
    exit 1
}
docker compose version *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Error 'Docker Compose v2 não encontrado. Instale ou atualize o Docker Desktop.'
    exit 1
}
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Error 'Docker não está iniciado. Abra o Docker Desktop e tente novamente.'
    exit 1
}

if (-not (Test-Path -LiteralPath '.env')) {
    Copy-Item -LiteralPath '.env.example' -Destination '.env'
    Write-Host 'Arquivo .env criado. Edite POSTGRES_PASSWORD e a senha dentro de DATABASE_URL'
    Write-Host 'com o mesmo valor. Preencha JWT_SECRET e META_CREDENTIALS_ENCRYPTION_KEY.'
    Write-Host 'Veja os comandos de geração no README. Depois rode este script novamente.'
    exit 0
}

$settings = @{}
foreach ($line in Get-Content -LiteralPath '.env') {
    if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $settings[$Matches[1]] = $Matches[2]
    }
}
foreach ($name in @('POSTGRES_PASSWORD', 'DATABASE_URL', 'JWT_SECRET', 'META_CREDENTIALS_ENCRYPTION_KEY')) {
    $value = [string]$settings[$name]
    if ([string]::IsNullOrWhiteSpace($value) -or $value.Contains('troque_')) {
        Write-Error "Preencha $name no .env antes de continuar (veja o README)."
        exit 1
    }
}

docker compose config --quiet
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
docker compose up --build -d
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
docker compose ps
Write-Host 'Acesse http://localhost:3000/register para criar a primeira conta.'
Write-Host 'Se definiu DASHBOARD_ADMIN_EMAIL, use http://localhost:3000/login com esse e-mail.'
Write-Host 'Sem provedor de e-mail, o link de confirmação aparece em: docker compose logs backend'
