$base = "C:\Users\Ranjit\tantra_gated_bridge\services"
$if = "C:\Users\Ranjit\services\insightflow"

$jobs = @()

$jobs += Start-Job -Name "sarathi" -ScriptBlock { Set-Location $args[0]; node app.js } -ArgumentList "$base\sarathi"
$jobs += Start-Job -Name "core" -ScriptBlock { Set-Location $args[0]; node app.js } -ArgumentList "$base\core"
$jobs += Start-Job -Name "bridge" -ScriptBlock { Set-Location $args[0]; node app.js } -ArgumentList "$base\bridge"
$jobs += Start-Job -Name "execution" -ScriptBlock { Set-Location $args[0]; node app.js } -ArgumentList "$base\execution"
$jobs += Start-Job -Name "bucket" -ScriptBlock { Set-Location $args[0]; node app.js } -ArgumentList "$base\bucket"
$jobs += Start-Job -Name "insightflow" -ScriptBlock { Set-Location $args[0]; node local_receiver.js } -ArgumentList $if

Write-Output "Started $($jobs.Count) jobs"
$jobs | Format-Table Id, Name, State

# Wait for services to come up
Start-Sleep -Seconds 3

# Check health
"core:3000","sarathi:3001","bridge:3002","execution:3003","bucket:3004","insightflow:3005" | ForEach-Object {
    $s,$p = $_ -split ":"
    try {
        $r = Invoke-RestMethod -Uri "http://localhost:$p/health" -TimeoutSec 3 -ErrorAction Stop
        Write-Output "  [$s] HEALTHY on port $p - service=$($r.service)"
    } catch {
        Write-Output "  [$s] UNHEALTHY on port $p - $($_.Exception.Message)"
    }
}
