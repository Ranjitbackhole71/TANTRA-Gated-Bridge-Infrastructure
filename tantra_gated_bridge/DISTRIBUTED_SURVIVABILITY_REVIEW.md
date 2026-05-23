# TANTRA Gated Bridge — Distributed Survivability Review

## 1. Survivable Components

### 1.1 Stateless Services (Fully restartable)

| Service | State | Restart Behavior |
|---|---|---|
| core | Stateless | All state in request processing; no persistence |
| sarathi | In-memory token cache | jti replay cache cleared on restart; key pair regenerated if not in env |
| bridge | In-memory replay cache | jti replay cache cleared on restart; public key re-fetched |
| execution | Stateless | No persistence; workload is simulated |

### 1.2 Stateful Services (Persistence survives restart)

| Service | State Location | Persistence Mechanism | Restart Behavior |
|---|---|---|---|
| bucket | `bucket.db` (SQLite) | File-based database | Data survives; connection re-established on restart |
| replay_persistence | `data/replay_log.jsonl` + `data/replay_chain.json` | Append-only file | Chain state re-read from file; records intact |

## 2. Lifecycle Survivability Tests

### 2.1 Test Results (Real Process Lifecycle)

The following tests execute actual Docker container lifecycle operations (stop, start, rm, up) against running services.

| ID | Test | Type | Expected | Verification |
|---|---|---|---|---|
| SURV-001-real | Kill Bridge during execution | Container stop | Log entry written before and after; chain integrity intact | `validateChainIntegrity()` + `reconstructTrace()` |
| SURV-002-real | Restart Bridge (cold) | `docker compose stop/rm/up` | Bridge re-joins; chain integrity intact | Health check + chain validation |
| SURV-003-real | Restart Bucket | Container stop/start | Bucket re-joins with data intact | Health check + read-after-write verification |
| SURV-004-real | Replay persistence restart | Module reload | Chain re-read from file; reconstruction works | `validateChainIntegrity()` + `verifyDeterministicReplay()` |
| SURV-005-real | No trace mutation after restart | Deterministic replay | `reconstructTrace()` returns identical results | `verifyDeterministicReplay()` |
| SURV-006-real | Chain integrity after restart | Full chain scan | All hashes valid; all parent links intact | `validateChainIntegrity()` across all records |
| SURV-007-real | Degraded dependency visibility | Failure recording | Dependency failures recorded and reconstructable | `getTelemetryForTrace()` + `reconstructTrace()` |

## 3. Survivability Proof Artifacts

### 3.1 Generated Artifacts

After running `run_lifecycle_tests.sh` or `run_lifecycle_tests.ps1`:

```
services/survivability_tests/proof/real_survivability_proof.json
```

Contains:
- Test results per scenario (PASS/FAIL)
- Chain state at time of testing
- Chain integrity result
- Corruption scan result

### 3.2 Continuous Proof

The replay log itself is a survivability proof artifact. Each record in `replay_log.jsonl` is:
- Hash-chained to the previous record
- Immutable (append-only)
- Reconstructable after any number of restarts

## 4. Degraded Mode Visibility

### 4.1 Recorded Degradation Events

| Event | Telemetry Type | Recorded Fields |
|---|---|---|
| Execution service down | `telemetry:dependency_failure` | failed_dependency, error_message |
| Token rejection | `telemetry:rejection` | rejection_reason |
| Network timeout | `telemetry:dependency_failure` | failed_dependency, error_message |
| Service unavailable | `telemetry:dependency_failure` | failed_dependency, error_message |
| State transition failure | `telemetry:execution_transition` | from_status, to_status |

### 4.2 Degradation Trace Reconstruction

```bash
node -e "
const t = require('./services/observability/telemetry_emitter');
const r = require('./services/replay_reconstruction/reconstruction_tool');
// All dependency failures for a trace
const failures = t.getTelemetryForTrace('<trace_id>')
  .filter(e => e.event_type === 'telemetry:dependency_failure');
console.log(JSON.stringify(failures, null, 2));
"
```

## 5. Restart Proof Verification

### 5.1 Automated Proof

Run the full survivability proof:

```bash
# Simulated restart tests (data layer)
cd services/survivability_tests
node test_suite.js --proof

# Real process lifecycle tests (requires Docker)
./run_lifecycle_tests.sh
```

### 5.2 Expected Results

Both test suites should report 7/7 PASS for all survivability scenarios. Any failure indicates a regression in the survivability layer.

## 6. Distributed Survivability Gaps

| Gap | Impact | Mitigation |
|---|---|---|
| No cross-node failover | Single node loss = total system loss | Deploy behind load balancer; use Docker Swarm/K8s for multi-node |
| No health check routing | No automatic traffic redirection | Manual DNS/service discovery configuration |
| No persistent volume for replay log | Log lost on Docker volume destroy | Map host volume: `-v ./data:/app/data` |
| No log replication | Log single point of failure | Configure Logstash/Fluentd to tail and forward |
| No database replication (Bucket) | Bucket single point of failure | Use external PostgreSQL instead of SQLite |
