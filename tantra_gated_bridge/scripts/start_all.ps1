Write-Host "=========================================="
Write-Host " TANTRA Gated Bridge - Starting Full Stack"
Write-Host "=========================================="
Write-Host ""

$composeFile = if (Test-Path ".\deployment\docker-compose.yml") { ".\deployment\docker-compose.yml" } else { "..\deployment\docker-compose.yml" }

Write-Host "[1/3] Building images..."
docker compose -f $composeFile build

Write-Host "[2/3] Starting services..."
docker compose -f $composeFile up -d

Write-Host "[3/3] Waiting for health checks..."
Start-Sleep -Seconds 5

$services = @("core", "sarathi", "bridge", "execution", "bucket")
foreach ($svc in $services) {
    try {
        $port = switch ($svc) {
            "core" { 3000 }
            "sarathi" { 3001 }
            "bridge" { 3002 }
            "execution" { 3003 }
            "bucket" { 3004 }
        }
        $response = Invoke-RestMethod -Uri "http://localhost:$port/health" -TimeoutSec 3
        if ($response.status -eq "healthy") {
            Write-Host "  [$svc] HEALTHY (port $port)"
        }
    } catch {
        Write-Host "  [$svc] UNHEALTHY (port $port): $_"
    }
}

Write-Host ""
Write-Host "=========================================="
Write-Host " Stack is running"
Write-Host " Core:      http://localhost:3000"
Write-Host " Sarathi:   http://localhost:3001"
Write-Host " Bridge:    http://localhost:3002"
Write-Host " Execution: http://localhost:3003"
Write-Host " Bucket:    http://localhost:3004"
Write-Host "=========================================="
Write-Host ""
Write-Host "Test an execution:"
Write-Host '  curl -X POST http://localhost:3000/initiate -H "Content-Type: application/json" -d "{\"workload\":\"test\"}"'
