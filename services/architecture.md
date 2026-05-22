# TANTRA Infrastructure Architecture

## System Topology

```
Core Service (Port 3000)
    ↓
Sarathi Authority Service (Port 3001)
    ↓
Bridge Service (Port 3002)
    ↓
Execution Service (Port 3003)
    ↓
Bucket Service (Port 3004)
```

## Service Responsibilities

### Core Service
- Entry point for workflows
- Generates immutable trace_id and execution_id
- Initiates token request to Sarathi
- Forwards requests to Bridge with valid JWT
- **HARD FAIL**: Stops if Sarathi or Bridge unavailable

### Sarathi Authority Service
- ONLY service that generates JWT tokens
- Uses RS256 signing (external authority only)
- Validates trace_id and execution_id inclusion
- Exposes public key endpoint for verification
- **NO token generation elsewhere in system**

### Bridge Service
- PASSIVE forwarding only
- Validates JWT from Sarathi (issuer, expiry, signature)
- Enforces immutable trace_id and execution_id
- Forwards to Execution Service
- **FORBIDDEN**: token generation, execution logic, fallback paths, mock execution
- **HARD FAIL**: Stops immediately if dependencies fail

### Execution Service
- External to Bridge (enforced separation)
- Validates bridge signature (JWT from Sarathi)
- Executes workload
- Stores artifacts in Bucket
- **HARD FAIL**: Stops if Bucket unavailable

### Bucket Service
- Artifact storage
- MANDATORY read-after-write verification
- Hash verification (SHA-256)
- Schema validation
- **HARD FAIL**: Stops if verification fails

## Zero-Trust Boundaries

1. **No Local Signing**: Bridge cannot sign tokens - must use Sarathi
2. **No Local Execution**: Bridge cannot execute workloads - must use Execution Service
3. **No Fallback Paths**: All failures stop the system immediately
4. **Immutable IDs**: trace_id and execution_id cannot be mutated across services
5. **External Verification**: All services verify JWTs via Sarathi's public key

## Failure Propagation

- Sarathi down → Core BLOCKS
- Invalid/tampered token → Bridge BLOCKS
- Execution down → Bridge FAILS
- Bucket failure → Execution FAILS
- No degraded mode, no retries masking failure

## API Contracts

### POST /initiate (Core)
Request:
```json
{
  "workload": "task-name"
}
```

Response:
```json
{
  "trace_id": "uuid",
  "execution_id": "uuid",
  "status": "completed",
  "result": { ... }
}
```

### POST /token (Sarathi)
Request:
```json
{
  "trace_id": "uuid",
  "execution_id": "uuid"
}
```

Response:
```json
{
  "token": "jwt-string",
  "trace_id": "uuid",
  "execution_id": "uuid"
}
```

### POST /execute (Bridge)
Headers:
```
Authorization: Bearer <jwt>
```

Request:
```json
{
  "workload": "task-name",
  "trace_id": "uuid",
  "execution_id": "uuid"
}
```

Response: Execution Service response

### POST /run (Execution)
Request:
```json
{
  "workload": "task-name",
  "trace_id": "uuid",
  "execution_id": "uuid",
  "bridge_signature": "Bearer <jwt>"
}
```

Response:
```json
{
  "trace_id": "uuid",
  "execution_id": "uuid",
  "status": "completed",
  "result": { ... },
  "artifact_location": "artifacts/uuid/uuid"
}
```

---

## Survivability + Replay Hardening Layer (v1.0)

### Replay Persistence Module (`replay_persistence/`)

The replay persistence layer provides append-only, restart-safe record storage for all execution events.

**Components**:
- `append_only_store.js` — Core append-only log with SHA-256 hash chain (JSONL format)
- `lineage_tracker.js` — Immutable lineage reference tracking and graph building
- `continuity_recorder.js` — Records execution transitions, rejections, and dependency failures
- `idempotency_store.js` — Distributed-safe idempotency via append-only log scanning

**Records persisted to**: `replay_persistence/data/replay_log.jsonl`

**Key Guarantees**:
- Append-only: records never modified after write
- Hash chain: each record links to previous via `parent_hash`
- Restart-safe: all state survives service restart
- Deterministic replay: same inputs produce identical reconstruction

### Replay Reconstruction Module (`replay_reconstruction/`)

**Components**:
- `reconstruction_tool.js` — Trace/execution reconstruction from persisted records
- `lineage_graph.js` — Full lineage graph reconstruction across executions
- `corruption_detector.js` — Tamper detection via hash chain verification
- `verification_flow.js` — Deterministic replay verification and integrity checks

**Reconstruction Commands**:
```bash
node replay_reconstruction/reconstruction_tool.js <trace_id>
node replay_reconstruction/verification_flow.js <trace_id>
```

### Observability Module (`observability/`)

**Components**:
- `telemetry_emitter.js` — Passive structured execution telemetry
- `trace_collector.js` — Distributed trace span emission
- `replay_hooks.js` — Replay visibility hooks (explicitly called, never self-registering)

**Constraints**:
- ALL telemetry is passive (`passive: true` in every payload)
- NO middleware registration
- NO header injection for context propagation

### Survivability Tests (`survivability_tests/`)

7 scenarios covering bridge restart, bucket restart, reconstruction persistence, corrupted lineage isolation, concurrent validation, failure propagation, and degraded trace continuity.

Run:
```bash
cd survivability_tests
node test_suite.js --proof
```

### POST /store (Bucket)
Request:
```json
{
  "trace_id": "uuid",
  "execution_id": "uuid",
  "result": { ... },
  "timestamp": "iso-string",
  "duration_ms": 100
}
```

Response:
```json
{
  "location": "artifacts/uuid/uuid",
  "trace_id": "uuid",
  "execution_id": "uuid",
  "hash": "sha256-hex",
  "verified": true
}
```
