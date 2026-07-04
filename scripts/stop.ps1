# TANTRA STOP — Gracefully stop all services
# Usage: .\scripts\stop.ps1 [-Mode docker|native]

param(
    [Parameter(Position=0)]
    [ValidateSet("docker", "d", "native", "n")]
    [string]$Mode = "docker"
)

Write-Host "========================================"
Write-Host "  TANTRA Infrastructure — STOP"
Write-Host "========================================"

if ($Mode -eq "docker" -or $Mode -eq "d") {
    Write-Host "Mode: Docker Compose"
    Write-Host ""
    
    Push-Location "$PSScriptRoot\..\services"
    
    Write-Host "Stopping services..."
    docker-compose down --timeout 5
    
    Pop-Location
    
    Write-Host ""
    Write-Host "========================================"
    Write-Host "  All Docker services stopped"
    Write-Host "========================================"
    
} elseif ($Mode -eq "native" -or $Mode -eq "n") {
    Write-Host "Mode: Native (Node.js)"
    Write-Host ""
    
    $pidFile = "$PSScriptRoot\..\tantra.pids"
    
    if (-not (Test-Path $pidFile)) {
        Write-Host "No PID file found. Attempting to find and kill processes by port..."
        $ports = @(3000, 3001, 3002, 3003, 3004)
        foreach ($port in $ports) {
            $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
            foreach ($conn in $connections) {
                $pid = $conn.OwningProcess
                if ($pid -and $pid -ne 0) {
                    Write-Host "  Stopping process on port $port (PID: $pid)..."
                    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                }
            }
        }
        Write-Host ""
        Write-Host "Waiting for processes to exit..."
        Start-Sleep -Seconds 3
        Write-Host "========================================"
        Write-Host "  All services stopped"
        Write-Host "========================================"
        exit 0
    }
    
    Write-Host "Reading PID file: $pidFile"
    $pids = Get-Content $pidFile | Where-Object { $_ -match '^\d+$' }
    
    foreach ($pid in $pids) {
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "  Sending SIGTERM to PID $pid..."
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
    }
    
    Write-Host ""
    Write-Host "Waiting for processes to exit gracefully..."
    Start-Sleep -Seconds 3
    
    # Force kill any remaining
    foreach ($pid in $pids) {
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "  Force killing PID $pid..."
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
    }
    
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    
    Write-Host ""
    Write-Host "========================================"
    Write-Host "  All native services stopped"
    Write-Host "========================================"
    
} else {
    Write-Host "Usage: .\scripts\stop.ps1 [-Mode docker|native]"
    exit 1
}
