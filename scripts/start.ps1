# TANTRA START — Single command to start all services
# Usage: .\scripts\start.ps1 [-Mode docker|native]

param(
  [ValidateSet("docker", "native")]
  [string]$Mode = "docker"
)

Write-Host "========================================"
Write-Host "  TANTRA Infrastructure — START"
Write-Host "========================================"
Write-Host ""

if ($Mode -eq "docker") {
  Write-Host "Mode: Docker Compose"
  Write-Host ""
  
  # Check Docker
  $dockerVersion = docker --version 2>$null
  if (-not $dockerVersion) {
    Write-Host "ERROR: Docker not found"
    exit 1
  }
  
  Set-Location "$PSScriptRoot\..\services"
  
  # Check if images exist
  $imagesExist = docker images -q services-core 2>$null
  if ($imagesExist) {
    Write-Host "Images exist, skipping build"
  } else {
    Write-Host "Building images..."
    docker-compose build
    if (-not $?) { exit 1 }
  }
  
  Write-Host "Starting services..."
  docker-compose up -d
  if (-not $?) { exit 1 }
  
  Write-Host ""
  Write-Host "Waiting for services to be ready..."
  Start-Sleep -Seconds 3
  
  Write-Host ""
  Write-Host "Health check:"
  foreach ($port in @(3000, 3001, 3002, 3003, 3004)) {
    try {
      $result = Invoke-RestMethod -Uri "http://localhost:$port/health" -TimeoutSec 2 -ErrorAction Stop
      Write-Host "  Port $port: $($result.service)"
    } catch {
      Write-Host "  Port $port: DOWN"
    }
  }
  
  Write-Host ""
  Write-Host "========================================"
  Write-Host "  All services started"
  Write-Host "  Core:      http://localhost:3000"
  Write-Host "  Sarathi:   http://localhost:3001"
  Write-Host "  Bridge:    http://localhost:3002"
  Write-Host "  Execution: http://localhost:3003"
  Write-Host "  Bucket:    http://localhost:3004"
  Write-Host "========================================"
  
} elseif ($Mode -eq "native") {
  Write-Host "Mode: Native (Node.js)"
  Write-Host ""
  
  Set-Location "$PSScriptRoot\..\services"
  
  $pidFile = "$PSScriptRoot\..\tantra.pids"
  if (Test-Path $pidFile) { Remove-Item $pidFile -Force }
  
  Write-Host "Starting services..."
  
  $services = @(
    @{ name = "core"; dir = "core"; port = 3000 },
    @{ name = "sarathi"; dir = "sarathi"; port = 3001 },
    @{ name = "bridge"; dir = "bridge"; port = 3002 },
    @{ name = "execution"; dir = "execution"; port = 3003 },
    @{ name = "bucket"; dir = "bucket"; port = 3004 }
  )
  
  foreach ($svc in $services) {
    Write-Host "  Starting $($svc.name)..."
    $proc = Start-Process -FilePath "node" -ArgumentList "app.js" -WorkingDirectory "$PSScriptRoot\..\services\$($svc.dir)" -PassThru -NoNewWindow
    Add-Content -Path $pidFile -Value $proc.Id
    Start-Sleep -Milliseconds 500
  }
  
  Write-Host ""
  Write-Host "PIDs written to: $pidFile"
  Write-Host "Waiting for services to be ready..."
  Start-Sleep -Seconds 3
  
  Write-Host ""
  Write-Host "Health check:"
  foreach ($port in @(3000, 3001, 3002, 3003, 3004)) {
    try {
      $result = Invoke-RestMethod -Uri "http://localhost:$port/health" -TimeoutSec 2 -ErrorAction Stop
      Write-Host "  Port $port: $($result.service)"
    } catch {
      Write-Host "  Port $port: DOWN"
    }
  }
  
  Write-Host ""
  Write-Host "========================================"
  Write-Host "  All services started (native mode)"
  Write-Host "  Stop with: .\scripts\stop.ps1 -Mode native"
  Write-Host "========================================"
}
