# Testing Department Packet — TANTRA Final Completion

## Task Summary

| Item | Description |
|---|---|
| **System** | TANTRA Gated Bridge — 5 microservices with replay persistence and survivability |
| **Purpose** | Validate final closure: real execution, distributed replay, authority durability, survivability |
| **Scope** | All 5 services (Core, Sarathi, Bridge, Execution, Bucket) + replay + observability + InsightFlow |
| **Type** | Integration + survivability + proof generation |

---

## Runtime Behavior

### Normal Flow
```
POST /initiate (Core:3000)
  → generates trace_id + execution_id
  → POST /token (Sarathi:3001) → JWT with jti
  → POST /execute (Bridge:3002)
    → validates JWT (issuer, expiry, signature, jti)
    → enforces immutable IDs
    → POST /run (Execution:3003)
      → validates bridge signature
      → executes workload (adapter pattern)
      → POST /store (Bucket:3004)
        → SQLite write
        → read-after-write verify
        → SHA-256 hash
  → returns result to caller
```

### Failure Flow
```
Sarathi down → Core returns 503 (no fallback)
Invalid token → Bridge returns 401 (no execution)
ID mutation → Bridge returns 400 (blocked)
Execution down → Bridge returns 503 (no local execution)
Bucket down → Execution returns 503 (no local storage)
```

### Replay Flow
```
Execution event → append_only_store.appendRecord()
  → SHA-256 hash computed
  → parent_hash links to previous record
  → written to replay_log.jsonl
  → reconstructable via reconstruction_tool.js
```

---

## Exact Commands

### 0. Prerequisites
```bash
# Verify Node.js
node --version  # v18+ required

# Verify Docker (optional)
docker --version
docker-compose --version
```

### 1. START
```bash
# Option A: Docker (recommended)
bash scripts/start.sh docker

# Option B: Native
bash scripts/start.sh native

# Windows
.\scripts\start.ps1 -Mode docker
```

**Expected**: 5 services healthy on ports 3000-3004

### 2. VERIFY
```bash
bash scripts/verify.sh
```

**Expected**: All health checks pass, E2E workflow returns completed, replay protection works.

### 3. FULL CONVERGENCE PROOF
```bash
bash scripts/convergence_proof.sh
```

**Expected**: Generates `proof/convergence_<timestamp>/` directory with:
- health_*.json (5 files)
- e2e_workflow.json
- artifact.json
- token_response.json
- replay_first.txt, replay_second.txt
- failure_invalid_token.txt, failure_id_mutation.txt
- replay_log.jsonl, replay_chain.json
- survivability_output.txt
- chain_integrity.json
- key_meta.json

### 4. Integration Verification
```bash
bash scripts/integration_verify.sh
```

**Expected**: All integration points pass.

---

## Health Verification

```bash
# Quick health check
for port in 3000 3001 3002 3003 3004; do
  echo -n "Port $port: "
  curl -s --connect-timeout 2 http://localhost:$port/health | jq -r '.service // "DOWN"'
done
```

### Expected Output
```
Port 3000: core
Port 3001: sarathi
Port 3002: bridge
Port 3003: execution
Port 3004: bucket
```

### Health Matrix

| Service | Healthy Response |
|---------|-----------------|
| Core | `{"service":"core","status":"healthy"}` |
| Sarathi | `{"service":"sarathi","status":"healthy","issuer":"tantra-sarathi"}` |
| Bridge | `{"service":"bridge","status":"healthy"}` |
| Execution | `{"service":"execution","status":"healthy"}` |
| Bucket | `{"service":"bucket","status":"healthy"}` |

---

## Replay Verification

### Chain Integrity
```bash
node -e "
const store = require('./services/replay_persistence/append_only_store');
const r = store.validateChainIntegrity();
console.log('Valid:', r.valid, 'Records:', r.record_count);
"
```

### Trace Reconstruction
```bash
# Get a trace_id from a workflow execution, then:
node services/replay_reconstruction/reconstruction_tool.js <trace_id>
```

### Full Verification
```bash
node services/replay_reconstruction/verification_flow.js
```

### Deterministic Replay
```bash
node -e "
const reconstruction = require('./services/replay_reconstruction/reconstruction_tool');
const store = require('./services/replay_persistence/append_only_store');
const records = store.getAllRecords();
const traceIds = [...new Set(records.map(r => r.trace_id))];
for (const tid of traceIds.slice(0, 3)) {
  const r1 = reconstruction.reconstructTrace(tid);
  const r2 = reconstruction.reconstructTrace(tid);
  const ok = r1.record_count === r2.record_count && r1.execution_count === r2.execution_count;
  console.log(tid.slice(0, 8), 'deterministic:', ok);
}
"
```

---

## Degradation Testing

### Survivability Tests
```bash
# Core survivability (7 scenarios)
cd services/survivability_tests && node test_suite.js --proof

# Degraded survivability (6 scenarios)
cd services/survivability_tests && node degraded_survivability.js
```

### Test Scenarios

| ID | Scenario | Verifies |
|---|---|---|
| SURV-001 | Bridge restart during execution | Replay persistence survives service restart |
| SURV-002 | Bucket restart during replay verification | Verification consistent after restart |
| SURV-003 | Replay reconstruction after restart | Full reconstruction succeeds |
| SURV-004 | Corrupted lineage isolation | Valid traces isolated from corruption |
| SURV-005 | Concurrent replay-chain validation | Concurrent validations don't interfere |
| SURV-006 | Service unavailability propagation | Failures correctly recorded |
| SURV-007 | Trace continuity under degraded conditions | Chain integrity holds |
| SURV-008 | Network partition survivability | Failures reconstructable after partition |
| SURV-009 | Dependency instability (flapping) | All phases recorded |
| SURV-010 | Downstream loss (Bucket unavailable) | Failure trace reconstructable |
| SURV-011 | Authority degradation visibility | Authority failures visible and passive |
| SURV-012 | Observability continuity under degradation | All events passive, trace reconstructable |
| SURV-013 | Multi-instance reconstruction recovery | Deterministic across instances |

### Expected Results
```
SURVIVABILITY TEST SUITE RESULTS
  Total: 7
  Passed: 7
  Failed: 0

DEGRADED SURVIVABILITY RESULTS
  Total: 6
  Passed: 6
  Failed: 0
```

---

## Ecosystem Verification

### 1. JWT Security
```bash
# Verify RS256 signing
curl -s http://localhost:3001/public-key | head -c 50
# Expected: "-----BEGIN PUBLIC KEY-----\n..."

# Verify jti in tokens
curl -s -X POST http://localhost:3001/token \
  -H "Content-Type: application/json" \
  -d '{"trace_id":"test","execution_id":"test"}' | jq '.jti'
# Expected: UUID v4 string
```

### 2. Bridge Purity
```bash
# Verify no token generation in Bridge
grep -n "jwt.sign\|generateToken\|createToken" services/bridge/app.js || echo "PASS: No token generation"

# Verify no execution logic in Bridge
grep -n "executeWorkload\|workload" services/bridge/app.js || echo "PASS: No execution logic"
```

### 3. Trace Immutability
```bash
# Run full workflow, verify same trace_id across services
RESPONSE=$(curl -s -X POST http://localhost:3000/initiate \
  -H "Content-Type: application/json" \
  -d '{"workload":"eco-verify"}')
TRACE=$(echo "$RESPONSE" | jq -r '.trace_id')
EXEC=$(echo "$RESPONSE" | jq -r '.execution_id')
sleep 1
ARTIFACT=$(curl -s "http://localhost:3004/retrieve/$TRACE/$EXEC")
echo "Core trace_id: $TRACE"
echo "Bucket trace_id: $(echo $ARTIFACT | jq -r '.trace_id')"
echo "Match: $([ "$TRACE" = "$(echo $ARTIFACT | jq -r '.trace_id')" ] && echo 'YES' || echo 'NO')"
```

### 4. Bucket Persistence
```bash
# Verify SQLite file exists
ls -la services/bucket/bucket.db
# Expected: File exists, non-zero size

# Direct SQLite query
node -e "
const Database = require('better-sqlite3');
const db = new Database('services/bucket/bucket.db');
const count = db.prepare('SELECT COUNT(*) as c FROM artifacts').get().c;
console.log('Artifacts in database:', count);
db.close();
"
```

### 5. Key Persistence
```bash
# Verify Sarathi keys exist
ls -la services/sarathi/keys/ 2>/dev/null || echo "Keys in env vars (no file persistence)"

# Verify key metadata
cat services/sarathi/keys/key_meta.json 2>/dev/null || echo "No key meta file"
```

---

## Failure Matrix

| Failure | Trigger | Expected HTTP | Expected Behavior | Verifiable By |
|---------|---------|--------------|-------------------|---------------|
| Sarathi down | Stop sarathi | 503 | No fallback token | `curl POST /initiate` |
| Invalid token | Send bad JWT | 401 | Bridge rejects | `curl POST /execute -H "Authorization: Bearer invalid"` |
| Tampered token | Modify JWT payload | 401 | Signature fails | `curl POST /execute -H "Authorization: Bearer <tampered>"` |
| Replay token | Use JWT twice | 401 | jti detected | `curl POST /execute` twice with same JWT |
| Execution down | Stop execution | 503 | No fallback execution | `curl POST /execute` with valid token |
| Bucket failure | Stop bucket | 503 | No local storage | `curl POST /initiate` |
| ID mutation | Change trace_id | 400 | Bridge blocks | `curl POST /execute` with mismatched IDs |
| Network partition | Simulated | N/A (test) | Failure recorded | SURV-008 test |
| Dependency flapping | Simulated | N/A (test) | All phases recorded | SURV-009 test |
| Downstream loss | Simulated | N/A (test) | Failure reconstructable | SURV-010 test |
| Authority degradation | Simulated | N/A (test) | Visible + passive | SURV-011 test |
| Key rotation | Manual rotate | 200 | New keys served | `GET /public-key` after rotation |

---

## Fresh Machine Startup

**Target**: 10–15 minutes from bare machine to verified deployment

### Steps
1. Install Node.js v18+ (2 min)
2. Install Docker (optional, 3 min)
3. Clone repository (1 min)
4. Install service dependencies (3 min):
   ```bash
   cd services
   for dir in core sarathi bridge execution bucket; do
     cd $dir && npm install && cd ..
   done
   cd replay_persistence && npm install && cd ..
   cd replay_reconstruction && npm install && cd ..
   cd observability && npm install && cd ..
   cd survivability_tests && npm install && cd ..
   ```
5. Start services (1 min): `bash scripts/start.sh docker`
6. Verify (1 min): `bash scripts/verify.sh`
7. Run convergence proof (2 min): `bash scripts/convergence_proof.sh`

**Total**: ~13 minutes

### Windows Alternative
```powershell
.\scripts\start.ps1 -Mode native
.\scripts\verify.ps1
.\scripts\convergence_proof.ps1
```
