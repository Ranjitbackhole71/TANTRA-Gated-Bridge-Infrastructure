# TANTRA Gated Bridge — Enhanced Code Packet

**Version**: 1.0.0
**Date**: 2026-07-14
**Purpose**: Review-critical code navigation for the TANTRA Gated Bridge

---

## 1. Why Every File Is Included

This CODE_PACKET contains only the code paths that a reviewer must understand to verify the zero-trust, hard-fail, replay-protected architecture. Each file is included because it implements one or more security-critical properties.

---

## 2. Core Entry Point — UUID Generation

**File**: `services/core/app.js` (115 lines)

**Why**: This is where trace_id and execution_id are born. Reviewers must verify these IDs are generated once via `crypto.randomUUID()` and never mutated downstream.

### Critical Code Path

```javascript
// Line 29-31: UUID generation (immutable after this point)
const trace_id = crypto.randomUUID();
const execution_id = crypto.randomUUID();
const cet_hash = crypto.createHash('sha256').update(trace_id + ':' + execution_id).digest('hex');
```

### Flow

1. Generate trace_id, execution_id, cet_hash
2. POST to Sarathi `/token` with these IDs
3. Receive JWT token
4. Forward to Bridge `/execute` with Bearer token + X-Sarathi headers

**Key Property**: Core is stateless. It generates IDs and forwards. It never validates tokens (that's Bridge's job).

---

## 3. JWT Authority — Token Issuance

**File**: `services/sarathi/app.js` (172 lines)

**Why**: Sole token issuer. Reviewers must verify no other service can sign tokens.

### Critical Code Path

```javascript
// Line 6: Key loading on startup
keyPersistence.loadOrGenerateKeys();

// Line 80-130: Token issuance endpoint
// Issues JWT with kid header, RS256 or EdDSA
// Claims: trace_id, execution_id, cet_hash, jti, iss, aud, iat, exp
```

### Key Features

- Dual algorithm: RS256 + EdDSA
- JWKS endpoint: `/.well-known/jwks.json` (RFC 7517)
- kid in JWT header for key resolution
- Key persistence via `key_persistence.js`

**Key Property**: Only Sarathi has private keys. All other services fetch public keys via JWKS.

---

## 4. Key Persistence — Rotation Support

**File**: `services/sarathi/key_persistence.js` (105 lines)

**Why**: Key generation, loading, and rotation. Reviewers must verify keys survive restart and rotation is supported.

### Critical Code Path

```javascript
// loadOrGenerateKeys(): Load from disk or generate new RSA + Ed25519 pairs
// rotateKeys(): Archive current keys, generate new pair, update key_meta.json
// Key files: private.pem, public.pem, ed25519_private.pem, ed25519_public.pem, key_meta.json
```

**Key Property**: Keys are file-based with mode 0600. Rotation archives previous keys. JWKS serves current keys only.

---

## 5. Bridge — Passive Forwarder (Security Core)

**File**: `services/bridge/app.js` (275 lines)

**Why**: This is the zero-trust enforcement point. Reviewers must verify: (1) JWT validation via JWKS, (2) kid-based key resolution, (3) replay detection, (4) immutable ID enforcement, (5) zero jwt.sign calls, (6) zero fallback paths.

### Critical Code Path

```javascript
// Line 33-55: fetchJwks() — JWKS with caching and stale-cache fallback
// Line 57-66: resolveJwk() — kid-based key selection from JWKS
// Line 72-92: verifyEdDSAToken() — EdDSA signature verification
// Line 94-153: validateToken middleware — JWT verification, replay detection via jtiStore
// Line 155-210: enforceContinuity middleware — trace_id/execution_id/cet_hash immutability
// Line 212-240: POST /execute — passive forwarding to Execution
```

### Security Checks (in order)

1. Fetch JWKS from Sarathi (with cache TTL)
2. Resolve key by kid from JWT header
3. Verify JWT signature (RS256 or EdDSA)
4. Validate issuer (`tantra-sarathi`) and audience (`tantra-bridge`)
5. Check jti against replay store (append-only SHA-256 chain)
6. Enforce trace_id immutability (body must match token)
7. Enforce execution_id immutability (body must match token)
8. Enforce cet_hash immutability (body + header must match token)
9. Forward to Execution with bridge_signature header

**Key Property**: Bridge has ZERO jwt.sign calls. ZERO execute calls. ZERO fallback. Hard-fail on any error.

---

## 6. Execution — Workload Executor

**File**: `services/execution/app.js` (242 lines)

**Why**: Workload execution with adapter pattern. Reviewers must verify bridge signature verification and artifact storage.

### Critical Code Path

```javascript
// Line 31-50: fetchJwks() from Sarathi
// Line 130-170: validateBridgeToken — verifies bridge signature via JWKS
// Line 185-220: POST /run — executes workload via participant, stores in Bucket
```

### Adapter Pattern

```javascript
// execution_participant.js — pluggable workload handler
module.exports = {
  async executeWorkload(workload, trace_id, execution_id) {
    // Default: simulated (setTimeout 100ms)
    // Override via EXECUTION_PARTICIPANT env var
  }
};
```

**Key Property**: Execution validates bridge signature before executing. Artifact stored in Bucket with SHA-256 hash.

---

## 7. Bucket — Artifact Storage

**File**: `services/bucket/app.js` (202 lines)

**Why**: Persistent storage with read-after-write verification. Reviewers must verify SHA-256 hash verification.

### Critical Code Path

```javascript
// Line 10: SQLite database initialization
// Line 46-95: POST /store — stores artifact with read-after-write verification
// Hash computed as SHA-256 of JSON-serialized result
// Verification: read back stored artifact, compare hash
```

**Key Property**: Every store is verified. Hash mismatch → rollback + 500. No silent failures.

---

## 8. Replay Persistence — Append-Only Chain

**File**: `services/replay_persistence/append_only_store.js` (132 lines)

**Why**: Core replay mechanism. Reviewers must verify append-only behavior and SHA-256 chain integrity.

### Critical Code Path

```javascript
// appendRecord(record): Append to JSONL, compute SHA-256 hash, link via previous_hash
// validateChainIntegrity(): Recompute all hashes, verify parent links
// getAllRecords(): Read all records from JSONL
```

### Chain Structure

```
record.hash = SHA-256(JSON.stringify(record) + record.previous_hash)
record.previous_hash = previous record.hash (or null for first record)
```

**Key Property**: Records are immutable after append. Chain integrity is always verifiable.

---

## 9. JTI Store — Durable Replay Protection

**File**: `services/replay_persistence/jti_store.js` (~50 lines)

**Why**: JTI persistence survives restart. Reviewers must verify warmJtiCache() loads from disk.

### Critical Code Path

```javascript
// recordJti(jti, trace_id, execution_id): Record JTI to append-only log
// hasJti(jti): Check if JTI exists in memory or on disk
// warmJtiCache(): Load all JTIs from replay log on startup
```

**Key Property**: JTI cache is warmed from disk on restart. Previously-used JTIs are rejected even after restart.

---

## 10. Replay Reconstruction — Read-Only Analysis

**File**: `services/replay_reconstruction/reconstruction_tool.js` (132 lines)

**Why**: Trace reconstruction is read-only. Reviewers must verify zero write operations.

### Critical Code Path

```javascript
// reconstructExecution(traceId, executionId): Single execution reconstruction
// reconstructTrace(traceId): Full trace with lineage and continuity
// reconstructByTimeRange(start, end): Time-range queries
// verifyReconstructable(traceId): Chain integrity + continuity verification
```

**Key Property**: Read-only. Never modifies replay log. Deterministic (same inputs → identical outputs).

---

## 11. Observability — Passive Telemetry

**File**: `services/observability/telemetry_emitter.js` (120 lines)

**Why**: Passive-only telemetry. Reviewers must verify zero HTTP calls, zero middleware, zero response modification.

### Critical Code Path

```javascript
// emitExecutionTelemetry(event): Append telemetry event to replay log
// All events tagged payload.passive: true
// Zero outbound HTTP calls
// Zero Express middleware registration
```

**Key Property**: Observability is passive. It emits but never acts.

---

## 12. Replay Hooks — Service Boundary Wiring

**File**: `services/observability/replay_hooks.js` (90 lines)

**Why**: Hooks at Bridge and Execution boundaries. Reviewers must verify hooks are call-only, not auto-registered.

### Critical Code Path

```javascript
// hookRequestReceived(req): Called at Bridge ingress
// hookExecutionTransition(data): Called on state change
// hookResponseSent(data): Called on completion
// All hooks are explicit function calls, not middleware
```

**Key Property**: Hooks are invoked explicitly. No auto-registration. No middleware pattern.

---

## 13. InsightFlow Adapter — Passive Forwarding

**File**: `services/insightflow/adapter.js` (119 lines)

**Why**: Telemetry forwarding to external InsightFlow. Reviewers must verify passive-only behavior.

### Critical Code Path

```javascript
// forwardTelemetry(event): Forward event to INSIGHTFLOW_URL (if configured)
// Only forwards if INSIGHTFLOW_ENABLED=true and INSIGHTFLOW_URL set
// Graceful degradation: no error if URL not configured
```

**Key Property**: Contract-only. No live InsightFlow URL configured. Adapter is passive.

---

## 14. Survivability Tests — Failure Scenarios

**File**: `services/survivability_tests/test_suite.js` (383 lines)

**Why**: 7 core survivability scenarios. Reviewers must verify system survives failures.

### Scenarios

| ID | What It Tests |
|---|---|
| SURV-001 | Bridge restart during execution |
| SURV-002 | Bucket restart during replay verification |
| SURV-003 | Replay reconstruction after restart |
| SURV-004 | Corrupted lineage isolation |
| SURV-005 | Concurrent replay-chain validation |
| SURV-006 | Service unavailability propagation |
| SURV-007 | Trace continuity under degraded conditions |

---

## 15. Startup Scripts

| Script | Purpose | Runtime |
|---|---|---|
| `scripts/start.sh` | Start all services (Docker or Native) | Linux/macOS |
| `scripts/start.ps1` | Start all services (Docker or Native) | Windows |
| `scripts/verify.sh` | Verify all services healthy | Linux/macOS |
| `scripts/verify.ps1` | Verify all services healthy | Windows |
| `scripts/convergence_proof.sh` | Full convergence proof | Linux/macOS |
| `scripts/convergence_proof.ps1` | Full convergence proof | Windows |
| `scripts/stop.sh` | Stop all services | Linux/macOS |
| `scripts/stop.ps1` | Stop all services | Windows |

---

## 16. Configuration

| File | Purpose |
|---|---|
| `services/core/.env` | Core: PORT, SARATHI_URL, BRIDGE_URL |
| `services/sarathi/.env` | Sarathi: PORT, ISSUER, JWT_EXPIRY |
| `services/bridge/.env` | Bridge: PORT, SARATHI_URL, EXECUTION_URL, INSIGHTFLOW_URL |
| `services/execution/.env` | Execution: PORT, SARATHI_URL, BUCKET_URL, EXECUTION_PARTICIPANT |
| `services/bucket/.env` | Bucket: PORT |
| `tantra_gated_bridge/configs/.env.example` | Global template |

---

## 17. File Summary

| # | File | Lines | Critical Path |
|---|---|---|---|
| 1 | `services/core/app.js` | 115 | UUID generation, flow initiation |
| 2 | `services/sarathi/app.js` | 172 | JWT authority, JWKS endpoint |
| 3 | `services/sarathi/key_persistence.js` | 105 | Key generation, loading, rotation |
| 4 | `services/bridge/app.js` | 275 | JWT validation, replay detection, immutability |
| 5 | `services/execution/app.js` | 242 | Workload execution, bridge verification |
| 6 | `services/execution/execution_participant.js` | 39 | Adapter pattern |
| 7 | `services/bucket/app.js` | 202 | SQLite storage, hash verification |
| 8 | `services/replay_persistence/append_only_store.js` | 132 | Append-only SHA-256 chain |
| 9 | `services/replay_persistence/jti_store.js` | 50 | Durable JTI persistence |
| 10 | `services/replay_reconstruction/reconstruction_tool.js` | 132 | Read-only trace reconstruction |
| 11 | `services/observability/telemetry_emitter.js` | 120 | Passive telemetry emission |
| 12 | `services/observability/replay_hooks.js` | 90 | Service boundary hooks |
| 13 | `services/insightflow/adapter.js` | 119 | Passive telemetry forwarding |
| 14 | `services/survivability_tests/test_suite.js` | 383 | 7 survivability scenarios |

**Total Review-Critical Code**: ~2,376 lines across 14 files

---

## References

| Document | Location |
|---|---|
| Review Packet | `FINAL_GATED_BRIDGE_CONVERGENCE.md` |
| Architecture | `docs/ARCHITECTURE.md` |
| API Reference | `docs/API.md` |
| Handover Packet | `FINAL_HANDOVER_PACKET.md` |
