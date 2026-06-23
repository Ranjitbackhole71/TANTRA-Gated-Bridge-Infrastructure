# TANTRA FULL CONVERGENCE PROOF — PowerShell
# Usage: .\scripts\convergence_proof.ps1

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$proofDir = "proof\convergence_$timestamp"
New-Item -ItemType Directory -Path $proofDir -Force | Out-Null

Write-Host "============================================"
Write-Host "  TANTRA FULL CONVERGENCE PROOF"
Write-Host "============================================"
Write-Host "  Timestamp: $(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')"
Write-Host "  Proof dir: $proofDir"
Write-Host "============================================"
Write-Host ""

# 1. Service Health
Write-Host "1. SERVICE HEALTH"
Write-Host "------------------"
$ports = @(3000, 3001, 3002, 3003, 3004)
foreach ($port in $ports) {
  try {
    $result = Invoke-RestMethod -Uri "http://localhost:$port/health" -TimeoutSec 2 -ErrorAction Stop
    $result | ConvertTo-Json | Out-File "$proofDir\health_$port.json"
    Write-Host "  ✅ Port $port : $($result.service)"
  } catch {
    @{service="DOWN"; status="unreachable"} | ConvertTo-Json | Out-File "$proofDir\health_$port.json"
    Write-Host "  ❌ Port $port : DOWN"
  }
}

# 2. E2E Workflow
Write-Host ""
Write-Host "2. END-TO-END WORKFLOW"
Write-Host "----------------------"
try {
  $body = @{workload = "convergence-proof"} | ConvertTo-Json
  $response = Invoke-RestMethod -Uri "http://localhost:3000/initiate" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 10
  $response | ConvertTo-Json -Depth 10 | Out-File "$proofDir\e2e_workflow.json"
  Write-Host "  ✅ Workflow: $($response.status)"
  Write-Host "  Trace ID: $($response.trace_id)"
  $global:traceId = $response.trace_id
  $global:execId = $response.execution_id
} catch {
  @{status="FAILED"; error=$_.Exception.Message} | ConvertTo-Json | Out-File "$proofDir\e2e_workflow.json"
  Write-Host "  ❌ Workflow failed: $_"
}

# 3. Trace Integrity
Write-Host ""
Write-Host "3. TRACE INTEGRITY"
Write-Host "------------------"
if ($global:traceId -and $global:execId) {
  try {
    $artifact = Invoke-RestMethod -Uri "http://localhost:3004/retrieve/$($global:traceId)/$($global:execId)" -TimeoutSec 5
    $artifact | ConvertTo-Json -Depth 10 | Out-File "$proofDir\artifact.json"
    if ($artifact.trace_id -eq $global:traceId) {
      Write-Host "  ✅ Trace immutable across services"
      Write-Host "  Hash: $($artifact.hash)"
    } else {
      Write-Host "  ❌ Trace mutation detected!"
    }
  } catch {
    Write-Host "  ❌ Artifact retrieval failed: $_"
  }
}

# 4. Summary
Write-Host ""
Write-Host "============================================"
Write-Host "  CONVERGENCE PROOF SUMMARY"
Write-Host "============================================"
Write-Host "  Proof directory: $proofDir"
Write-Host "  Files:"
Get-ChildItem -Path $proofDir | ForEach-Object { Write-Host "    $($_.Name)" }
Write-Host "============================================"
