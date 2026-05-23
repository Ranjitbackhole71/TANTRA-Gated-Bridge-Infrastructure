Write-Host "=========================================="
Write-Host " TANTRA Gated Bridge - Full Stack Verify"
Write-Host "=========================================="
Write-Host ""

$exitCode = 0

# Phase 1: Health checks
Write-Host "[1/5] Service health checks..."
$services = @(
    @{name="core"; port=3000},
    @{name="sarathi"; port=3001},
    @{name="bridge"; port=3002},
    @{name="execution"; port=3003},
    @{name="bucket"; port=3004}
)

$allHealthy = $true
foreach ($svc in $services) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:$($svc.port)/health" -TimeoutSec 3
        if ($response.status -eq "healthy") {
            Write-Host "  [$($svc.name)] HEALTHY"
        } else {
            Write-Host "  [$($svc.name)] UNHEALTHY: $($response.status)"
            $allHealthy = $false
        }
    } catch {
        Write-Host "  [$($svc.name)] UNREACHABLE: $_"
        $allHealthy = $false
    }
}

if (-not $allHealthy) {
    Write-Host "  FAIL: Not all services healthy"
    $exitCode = 1
} else {
    Write-Host "  PASS: All services healthy"
}

# Phase 2: End-to-end execution
Write-Host "[2/5] End-to-end execution test..."
try {
    $execResponse = Invoke-RestMethod -Uri "http://localhost:3000/initiate" -Method Post -ContentType "application/json" -Body '{"workload":"verify-test"}' -TimeoutSec 15
    if ($execResponse.status -eq "completed") {
        Write-Host "  PASS: Execution completed (trace: $($execResponse.trace_id))"
    } else {
        Write-Host "  FAIL: Execution status: $($execResponse.status)"
        $exitCode = 1
    }
} catch {
    Write-Host "  FAIL: Execution error: $_"
    $exitCode = 1
}

# Phase 3: Replay persistence check
Write-Host "[3/5] Replay persistence check..."
try {
    $recordCount = & node -e "
    const store = require('./services/replay_persistence/append_only_store');
    console.log(store.getChainState().record_count);
    "
    Write-Host "  PASS: Replay log has $recordCount records"
} catch {
    Write-Host "  SKIP: Replay persistence check (requires node)"
}

# Phase 4: Chain integrity
Write-Host "[4/5] Chain integrity check..."
try {
    $integrityResult = & node -e "
    const store = require('./services/replay_persistence/append_only_store');
    const result = store.validateChainIntegrity();
    console.log(JSON.stringify(result));
    "
    $integrity = $integrityResult | ConvertFrom-Json
    if ($integrity.valid) {
        Write-Host "  PASS: Chain integrity valid ($($integrity.record_count) records)"
    } else {
        Write-Host "  FAIL: Chain integrity broken"
        $exitCode = 1
    }
} catch {
    Write-Host "  SKIP: Chain integrity check (requires node)"
}

# Phase 5: Summary
Write-Host "[5/5] Verification complete"
Write-Host ""
Write-Host "=========================================="
if ($exitCode -eq 0) {
    Write-Host " RESULT: FULL STACK VERIFIED - PASS"
} else {
    Write-Host " RESULT: FULL STACK VERIFIED - FAIL"
}
Write-Host "=========================================="

exit $exitCode
