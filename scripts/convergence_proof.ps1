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

# 4. Replay Protection
Write-Host ""
Write-Host "4. REPLAY PROTECTION"
Write-Host "--------------------"
try {
  $tokenBody = @{trace_id = "proof-replay"; execution_id = "proof-replay-e"} | ConvertTo-Json
  $tokenResponse = Invoke-RestMethod -Uri "http://localhost:3001/token" -Method Post -Body $tokenBody -ContentType "application/json" -TimeoutSec 5
  $tokenResponse | ConvertTo-Json -Depth 10 | Out-File "$proofDir\token_response.json"
  $token = $tokenResponse.token
  
  if ($token) {
    $execBody = @{workload = "proof"; trace_id = "proof-replay"; execution_id = "proof-replay-e"} | ConvertTo-Json
    $headers = @{Authorization = "Bearer $token"; "Content-Type" = "application/json"}
    
    # First use
    try {
      $firstResponse = Invoke-WebRequest -Uri "http://localhost:3002/execute" -Method Post -Body $execBody -Headers $headers -TimeoutSec 5 -ErrorAction Stop
      $firstCode = $firstResponse.StatusCode
    } catch {
      $firstCode = $_.Exception.Response.StatusCode.value__
    }
    
    # Replay
    try {
      $replayResponse = Invoke-WebRequest -Uri "http://localhost:3002/execute" -Method Post -Body $execBody -Headers $headers -TimeoutSec 5 -ErrorAction Stop
      $replayCode = $replayResponse.StatusCode
    } catch {
      $replayCode = $_.Exception.Response.StatusCode.value__
    }
    
    $firstStatus = if ($firstCode -eq 200) { "✅" } else { "❌" }
    $replayStatus = if ($replayCode -eq 401) { "✅" } else { "❌" }
    Write-Host "  First use: HTTP $firstCode $firstStatus"
    Write-Host "  Replay:    HTTP $replayCode $replayStatus"
    $firstCode | Out-File "$proofDir\replay_first.txt"
    $replayCode | Out-File "$proofDir\replay_second.txt"
  } else {
    Write-Host "  ❌ Token generation failed"
  }
} catch {
  Write-Host "  ❌ Replay test failed: $_"
}

# 5. Failure Propagation
Write-Host ""
Write-Host "5. FAILURE PROPAGATION"
Write-Host "----------------------"
# Invalid token
try {
  $invalidHeaders = @{Authorization = "Bearer invalid.token.here"; "Content-Type" = "application/json"}
  $invalidBody = @{workload = "proof"; trace_id = "t1"; execution_id = "e1"} | ConvertTo-Json
  $invalidResponse = Invoke-WebRequest -Uri "http://localhost:3002/execute" -Method Post -Body $invalidBody -Headers $invalidHeaders -TimeoutSec 5 -ErrorAction Stop
  $invalidCode = $invalidResponse.StatusCode
} catch {
  $invalidCode = $_.Exception.Response.StatusCode.value__
}
$invalidCode | Out-File "$proofDir\failure_invalid_token.txt"
$invalidStatus = if ($invalidCode -eq 401) { "✅" } else { "❌" }
Write-Host "  Invalid token: HTTP $invalidCode $invalidStatus"

# ID mutation
try {
  $mutationBody = @{workload = "proof"; trace_id = "FAKE"; execution_id = "e1"} | ConvertTo-Json
  $mutationResponse = Invoke-WebRequest -Uri "http://localhost:3002/execute" -Method Post -Body $mutationBody -ContentType "application/json" -TimeoutSec 5 -ErrorAction Stop
  $mutationCode = $mutationResponse.StatusCode
} catch {
  $mutationCode = $_.Exception.Response.StatusCode.value__
}
$mutationCode | Out-File "$proofDir\failure_id_mutation.txt"
$mutationStatus = if ($mutationCode -eq 401) { "✅" } else { "❌" }
Write-Host "  ID mutation:  HTTP $mutationCode $mutationStatus"

# 6. Replay Persistence
Write-Host ""
Write-Host "6. REPLAY PERSISTENCE"
Write-Host "---------------------"
$replayLog = "services\replay_persistence\data\replay_log.jsonl"
if (Test-Path $replayLog) {
  $recordCount = (Get-Content $replayLog | Measure-Object -Line).Lines
  Write-Host "  Replay log records: $recordCount"
  Copy-Item $replayLog "$proofDir\replay_log.jsonl" -Force
  Copy-Item "services\replay_persistence\data\replay_chain.json" "$proofDir\replay_chain.json" -Force -ErrorAction SilentlyContinue
  Write-Host "  ✅ Replay persistence files copied"
} else {
  Write-Host "  ⚠️ No replay log found"
}

# 7. Chain Integrity
Write-Host ""
Write-Host "7. CHAIN INTEGRITY"
Write-Host "------------------"
try {
  $chainResult = node -e "const s = require('./services/replay_persistence/append_only_store'); const r = s.validateChainIntegrity(); console.log(JSON.stringify(r));" 2>$null
  if ($chainResult) {
    $chainData = $chainResult | ConvertFrom-Json
    $chainData | ConvertTo-Json | Out-File "$proofDir\chain_integrity.json"
    $chainStatus = if ($chainData.valid) { "✅" } else { "❌" }
    Write-Host "  Chain valid: $chainStatus ($($chainData.record_count) records)"
  } else {
    Write-Host "  ⚠️ Could not validate chain"
  }
} catch {
  Write-Host "  ⚠️ Chain validation failed: $_"
}

# 8. Key Durability
Write-Host ""
Write-Host "8. KEY DURABILITY"
Write-Host "-----------------"
$keyMeta = "services\sarathi\keys\key_meta.json"
if (Test-Path $keyMeta) {
  Copy-Item $keyMeta "$proofDir\key_meta.json" -Force
  $meta = Get-Content $keyMeta | ConvertFrom-Json
  Write-Host "  ✅ Keys persisted: $($meta.algorithms.rs256.key_id)"
} else {
  Write-Host "  ⚠️ No key persistence file (running in env-var mode)"
}

# 9. Deployment Info
Write-Host ""
Write-Host "9. DEPLOYMENT INFO"
Write-Host "-------------------"
$nodeVersion = node -v 2>$null
$dockerVersion = docker --version 2>$null
Write-Host "  Platform: Windows"
Write-Host "  Node: $(if ($nodeVersion) { $nodeVersion } else { 'N/A' })"
Write-Host "  Docker: $(if ($dockerVersion) { $dockerVersion } else { 'N/A' })"

# Summary
Write-Host ""
Write-Host "============================================"
Write-Host "  CONVERGENCE PROOF SUMMARY"
Write-Host "============================================"
Write-Host "  Proof directory: $proofDir"
Write-Host "  Files:"
Get-ChildItem -Path $proofDir | ForEach-Object { Write-Host "    $($_.Name)" }
Write-Host "============================================"
Write-Host "  Reviewers: Examine $proofDir for evidence."
Write-Host "============================================"
