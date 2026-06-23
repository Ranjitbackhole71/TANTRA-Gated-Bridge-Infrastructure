param(
    [string]$ServiceDir,
    [string]$Script = "app.js",
    [int]$Port = 0,
    [int]$WaitSeconds = 3
)

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "C:\Program Files\nodejs\node.exe"
$psi.Arguments = $Script
$psi.WorkingDirectory = $ServiceDir
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true

Write-Output "=== LAUNCHING: node $Script in $ServiceDir ==="
$p = [System.Diagnostics.Process]::Start($psi)
Start-Sleep -Milliseconds 1000

if ($p.HasExited) {
    Write-Output "EXIT CODE: $($p.ExitCode)"
    $out = $p.StandardOutput.ReadToEnd()
    $err = $p.StandardError.ReadToEnd()
    if ($out) { Write-Output "=== STDOUT ==="; Write-Output $out }
    if ($err) { Write-Output "=== STDERR ==="; Write-Output $err }
} else {
    Write-Output "PROCESS RUNNING (PID $($p.Id))"
    Start-Sleep -Seconds $WaitSeconds
    if ($p.HasExited) {
        Write-Output "Exited during wait. EXIT CODE: $($p.ExitCode)"
        $out = $p.StandardOutput.ReadToEnd()
        $err = $p.StandardError.ReadToEnd()
        if ($out) { Write-Output "=== STDOUT ==="; Write-Output $out }
        if ($err) { Write-Output "=== STDERR ==="; Write-Output $err }
    } else {
        Write-Output "PROCESS STILL RUNNING after $WaitSeconds seconds"
        if ($Port -gt 0) {
            try {
                $r = Invoke-RestMethod -Uri "http://localhost:$Port/health" -TimeoutSec 3 -ErrorAction Stop
                Write-Output "HEALTH: $($r | ConvertTo-Json -Compress)"
            } catch {
                Write-Output "HEALTH: FAILED - $($_.Exception.Message)"
            }
        }
        # Capture buffered output
        $out = $p.StandardOutput.ReadToEnd()
        $err = $p.StandardError.ReadToEnd()
        if ($out) { Write-Output "=== STDOUT ==="; Write-Output $out }
        if ($err) { Write-Output "=== STDERR ==="; Write-Output $err }
        $p.Kill()
    }
}
