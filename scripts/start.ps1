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
  
  Write-Host "Starting services..."
  
  $jobs = @()
  
  $jobs += Start-Job -ScriptBlock { Set-Location "$using:PSScriptRoot\..\services\core"; node app.js }
  Start-Sleep -Milliseconds 500
  $jobs += Start-Job -ScriptBlock { Set-Location "$using:PSScriptRoot\..\services\sarathi"; node app.js }
  Start-Sleep -Milliseconds 500
  $jobs += Start-Job -ScriptBlock { Set-Location "$using:PSScriptRoot\..\services\bridge"; node app.js }
  Start-Sleep -Milliseconds 500
  $jobs += Start-Job -ScriptBlock { Set-Location "$using:PSScriptRoot\..\services\execution"; node app.js }
  Start-Sleep -Milliseconds 500
  $jobs += Start-Job -ScriptBlock { Set-Location "$using:PSScriptRoot\..\services\bucket"; node app.js }
  
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
  Write-Host "  All services started (native mode)"
  Write-Host "  Background jobs: $($jobs.Count)"
  Write-Host "========================================"
}
