Set-StrictMode -Version Latest

if (-not (Test-Path ".\.env.mvp")) {
  Write-Host "Missing .env.mvp. Copy .env.mvp.example to .env.mvp and set OPENCLAW_GATEWAY_TOKEN."
  exit 1
}


# Chargement des variables pour vérification
Get-Content .\.env.mvp | ForEach-Object {
  if ($_ -match '^OPENCLAW_GATEWAY_TOKEN=(.*)$') {
    $env:OPENCLAW_GATEWAY_TOKEN = $matches[1]
  }
}

if ([string]::IsNullOrWhiteSpace($env:OPENCLAW_GATEWAY_TOKEN) -or $env:OPENCLAW_GATEWAY_TOKEN -eq "CHANGE_ME_LONG_RANDOM_TOKEN") {
  Write-Host "Error: OPENCLAW_GATEWAY_TOKEN is not set or is still the default value in .env.mvp." -ForegroundColor Red
  exit 1
}

New-Item -ItemType Directory -Force -Path ".\mvp-data\home" | Out-Null

# Debug mode
if ($args -contains "-Debug") {
  docker compose -f docker-compose.mvp.yml --env-file .env.mvp config
}

docker compose -f docker-compose.mvp.yml --env-file .env.mvp up -d --build
docker compose -f docker-compose.mvp.yml ps
