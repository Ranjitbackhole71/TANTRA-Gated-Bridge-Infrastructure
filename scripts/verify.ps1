# TANTRA VERIFY — Single command to verify system health
# Usage: .\scripts\verify.ps1

Write-Host "========================================"
Write-Host "  TANTRA Infrastructure — VERIFY"
Write-Host "========================================"
Write-Host ""

# 1. Health endpoints
Write-Host "1. Health Endpoints"
Write-Host "------------------"
$services = @(
  @{port=3000; name="core"},
  @{port=3001; name="sarathi"},
  @{port=3002; name="bridge"},
  @{port=3003; name="execution"},
  @{port=3004; name="bucket"}
)

foreach ($svc in $services) {
  try {
    $result = Invoke-RestMethod -Uri "http://localhost:$($svc.port)/health" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "  ✅ Port $($svc.port): $($result.service)"
  } catch {
    Write-Host "  ❌ Port $($svc.port): DOWN"
  }
}

Write-Host ""

# 2. E2E Workflow
Write-Host "2. E2E Workflow"
Write-Host "---------------"
try {
  $body = @{workload = "verify-test"} | ConvertTo-Json
  $response = Invoke-RestMethod -Uri "http://localhost:3000/initiate" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 10
  Write-Host "  ✅ Workflow: $($response.status)"
  Write-Host "  Trace ID: $($response.trace_id)"
  $script:traceId = $response.trace_id
  $script:executionId = $response.execution_id
} catch {
  Write-Host "  ❌ Workflow failed: $_"
  $script:traceId = $null
  $script:executionId = $null
}

Write-Host ""

# 3. Bucket Persistence
Write-Host "3. Bucket Persistence"
Write-Host "---------------------"
if ($script:traceId -and $script:executionId) {
  try {
    $artifact = Invoke-RestMethod -Uri "http://localhost:3004/retrieve/$($script:traceId)/$($script:executionId)" -TimeoutSec 5
    if ($artifact.trace_id -eq $script:traceId) {
      Write-Host "  ✅ Artifact stored and verified"
    } else {
      Write-Host "  ❌ Trace ID mismatch"
    }
  } catch {
    Write-Host "  ❌ Artifact retrieval failed"
  }
}

Write-Host ""

# 4. Summary
Write-Host "========================================"
Write-Host "  VERIFICATION COMPLETE"
Write-Host "========================================"
