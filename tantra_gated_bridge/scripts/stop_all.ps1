Write-Host "=========================================="
Write-Host " TANTRA Gated Bridge - Stopping Full Stack"
Write-Host "=========================================="

$composeFile = if (Test-Path "..\deployment\docker-compose.yml") { "..\deployment\docker-compose.yml" } else { ".\deployment\docker-compose.yml" }

docker compose -f $composeFile down

Write-Host ""
Write-Host "Stack stopped and cleaned up."
