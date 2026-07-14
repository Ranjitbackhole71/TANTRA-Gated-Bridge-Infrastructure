# TANTRA Gated Bridge — Ecosystem Attachment Registry

**Version**: 1.0.0
**Date**: 2026-07-14
**Status**: Active

---

## 1. Overview

This document catalogs every ecosystem participant that interacts with the TANTRA Gated Bridge. Each participant is documented with its purpose, interface, contracts, authentication, runtime expectations, failure behavior, replay behavior, and observability signals.

Only participants that exist in the repository or have documented interfaces are included.

---

## 2. Participant Registry

| # | Participant | Type | Direction | Status |
|---|---|---|---|---|
| 1 | Core Service | Internal | Pipeline | Active |
| 2 | Sarathi Service | Internal | Pipeline | Active |
| 3 | Bridge Service | Internal | Pipeline | Active |
| 4 | Execution Service | Internal | Pipeline | Active |
| 5 | Bucket Service | Internal | Pipeline | Active |
| 6 | InsightFlow Local Receiver | Internal | Telemetry | Active |
| 7 | Setu (User Product) | External | Inbound | Active |
| 8 | Replay Persistence | Internal | Storage | Active |
| 9 | Replay Reconstruction | Internal | Analysis | Active |
| 10 | Observability Modules | Internal | Telemetry | Active |
| 11 | Survivability Tests | Internal | Verification | Active |
| 12 | Logstash/Fluentd/Loki | External | Outbound | Compatible |
| 13 | Monitoring Systems | External | Outbound | Compatible |

---

## 3. Participant Details

### 3.1 Core Service

| Field | Value |
|---|---|
| **Purpose** | Entry point. Generates trace_id, execution_id, cet_hash. Requests JWT from Sarathi. Forwards to Bridge. |
| **Interface** | HTTP server on port 3000 |
| **Request Contract** | `POST /initiate` with `{"workload": "string"}` |
| **Response Contract** | `{"trace_id", "execution_id", "cet_hash", "status", "result", "artifact_location", "duration_ms"}` |
| **Authentication** | None (internal network) |
| **Runtime Expectations** | Response time <50ms. Stateless. Depends on Sarathi and Bridge. |
| **Failure Behaviour** | Returns 503 if Sarathi or Bridge unavailable. No retry, no fallback. |
| **Replay Behaviour** | Each request generates unique UUIDs. No idempotency key. |
| **Observability Signals** | None (Core does not emit telemetry directly) |

**File**: `services/core/app.js` (~115 lines)

---

### 3.2 Sarathi Service

| Field | Value |
|---|---|
| **Purpose** | JWT authority. Issues RS256/EdDSA tokens with jti, trace_id, execution_id, cet_hash. Serves JWKS endpoint. |
| **Interface** | HTTP server on port 3001 |
| **Request Contract** | `POST /token` with `{"trace_id", "execution_id", "cet_hash", "algorithm"}` |
| **Response Contract** | `{"token", "trace_id", "execution_id", "jti", "algorithm"}` |
| **Authentication** | None (internal network) |
| **Runtime Expectations** | Response time <10ms. Stateful (key persistence). Self-contained. |
| **Failure Behaviour** | Returns 500 if key generation fails. Keys persisted to disk. |
| **Replay Behaviour** | Each token has unique jti. Tokens expire after 1h (configurable). |
| **Observability Signals** | Health endpoint returns algorithms and issuer. |

**Files**: `services/sarathi/app.js` (~172 lines), `services/sarathi/key_persistence.js` (~105 lines)

---

### 3.3 Bridge Service

| Field | Value |
|---|---|
| **Purpose** | Passive forwarder. Validates JWT via JWKS (kid resolution). Enforces immutable IDs. Detects replay attacks. Forwards to Execution. |
| **Interface** | HTTP server on port 3002 |
| **Request Contract** | `POST /execute` with Authorization Bearer token + X-Sarathi headers + JSON body |
| **Response Contract** | Forwarded response from Execution service |
| **Authentication** | JWT Bearer token (validated against Sarathi JWKS) |
| **Runtime Expectations** | Response time <100ms. Stateless (in-memory cache only). Depends on Sarathi and Execution. |
| **Failure Behaviour** | 401 on invalid/replayed token. 400 on ID mutation. 503 if Execution unavailable. No fallback. |
| **Replay Behaviour** | jti tracked in append-only log. Duplicate jti → 401. Cache warmed from disk on restart. |
| **Observability Signals** | Emits telemetry events: request_received, execution_transition, rejection, dependency_failure, response_sent. All tagged passive:true. |

**File**: `services/bridge/app.js` (~275 lines)

---

### 3.4 Execution Service

| Field | Value |
|---|---|
| **Purpose** | Workload executor. Verifies bridge signature. Runs workload via adapter pattern. Stores artifact in Bucket. |
| **Interface** | HTTP server on port 3003 |
| **Request Contract** | `POST /run` with bridge_signature + workload + trace_id + execution_id |
| **Response Contract** | `{"trace_id", "execution_id", "status", "result", "artifact_location", "duration_ms"}` |
| **Authentication** | Bridge signature (JWT verified against Sarathi JWKS) |
| **Runtime Expectations** | Response time depends on workload (simulated: 100ms). Stateless. Depends on Sarathi and Bucket. |
| **Failure Behaviour** | 503 if Bucket unavailable. Returns error with replay log record. |
| **Replay Behaviour** | Execution events recorded in replay log. Artifact hash stored. |
| **Observability Signals** | Emits telemetry events via replay_hooks.js. All tagged passive:true. |

**Files**: `services/execution/app.js` (~242 lines), `services/execution/execution_participant.js` (~39 lines)

---

### 3.5 Bucket Service

| Field | Value |
|---|---|
| **Purpose** | Artifact storage. SQLite-backed with read-after-write verification and SHA-256 hash. |
| **Interface** | HTTP server on port 3004 |
| **Request Contract** | `POST /store` with trace_id, execution_id, result, timestamp, duration_ms |
| **Response Contract** | `{"location", "trace_id", "execution_id", "hash", "verified", "persistent"}` |
| **Authentication** | None (internal network) |
| **Runtime Expectations** | Response time <50ms. Stateful (SQLite database). Self-contained. |
| **Failure Behaviour** | Returns 500 on storage failure. Read-after-write verification fails → rollback + 500. |
| **Replay Behaviour** | Artifact hash stored in SQLite. No replay chain participation. |
| **Observability Signals** | None (Bucket does not emit telemetry directly) |

**File**: `services/bucket/app.js` (~202 lines)

---

### 3.6 InsightFlow Local Receiver

| Field | Value |
|---|---|
| **Purpose** | Passive telemetry ingestion. Receives and stores telemetry events. Provides query API. |
| **Interface** | HTTP server on port 3005 |
| **Request Contract** | `POST /api/v1/telemetry` with JSON payload |
| **Response Contract** | `{"received": true, "timestamp": "iso8601"}` |
| **Authentication** | None (internal network) |
| **Runtime Expectations** | Response time <10ms. Stateless (file-based storage). Optional. |
| **Failure Behaviour** | Graceful degradation — telemetry events lost if receiver unavailable. |
| **Replay Behaviour** | Not applicable (receives telemetry, does not participate in replay chain). |
| **Observability Signals** | Health endpoint returns service status. |

**Files**: `services/insightflow/local_receiver.js`, `services/insightflow/adapter.js`, `services/insightflow/INTEGRATION_CONTRACT.md`

---

### 3.7 Setu (User Product)

| Field | Value |
|---|---|
| **Purpose** | User-facing FastAPI product. Routes user requests through the full TANTRA runtime chain. |
| **Interface** | HTTP server on port 8000 |
| **Request Contract** | `POST /process` with `{"workload": "string"}` |
| **Response Contract** | Full TANTRA response with Setu metadata |
| **Authentication** | None (user-facing) |
| **Runtime Expectations** | Response time <300ms. Depends on Core. |
| **Failure Behaviour** | Returns 503 if Core unavailable. |
| **Replay Behaviour** | Each request generates unique trace. Reproducible across requests. |
| **Observability Signals** | Inherits TANTRA telemetry through the pipeline. |

**Files**: `setu/app.py`, `setu/requirements.txt`

---

### 3.8 Replay Persistence

| Field | Value |
|---|---|
| **Purpose** | Append-only SHA-256 hash chain journal. Stores all execution and telemetry events. |
| **Interface** | Node.js module (require) |
| **Request Contract** | `appendRecord(record)`, `getAllRecords()`, `validateChainIntegrity()` |
| **Response Contract** | Record objects with hash chain, integrity validation results |
| **Authentication** | Filesystem access |
| **Runtime Expectations** | Synchronous file I/O. Append-only. Deterministic. |
| **Failure Behaviour** | Write failure throws. Read failure returns empty array. |
| **Replay Behaviour** | Core replay mechanism. Chain integrity verifiable at any time. |
| **Observability Signals** | Chain state in `replay_chain.json`. Record count and last hash. |

**Files**: `services/replay_persistence/append_only_store.js`, `jti_store.js`, `lineage_tracker.js`, `continuity_recorder.js`, `idempotency_store.js`

---

### 3.9 Replay Reconstruction

| Field | Value |
|---|---|
| **Purpose** | Read-only trace reconstruction and verification. |
| **Interface** | Node.js module (require) |
| **Request Contract** | `reconstructTrace(id)`, `reconstructExecution(traceId, execId)`, `verifyReconstructable(id)` |
| **Response Contract** | Trace/execution objects with lineage and continuity data |
| **Authentication** | Filesystem read access |
| **Runtime Expectations** | Read-only. Deterministic. <100ms for typical traces. |
| **Failure Behaviour** | Returns `{found: false}` for unknown traces. Never throws. |
| **Replay Behaviour** | Reads replay log. Never modifies. Fully deterministic (TRC-CONT-001). |
| **Observability Signals** | None (read-only operation). |

**Files**: `services/replay_reconstruction/reconstruction_tool.js`, `verification_flow.js`, `corruption_detector.js`, `lineage_graph.js`

---

### 3.10 Observability Modules

| Field | Value |
|---|---|
| **Purpose** | Passive telemetry emission. Distributed trace spans. Replay hooks. |
| **Interface** | Node.js module (require) |
| **Request Contract** | `emitExecutionTelemetry()`, `emitTrace()`, `hook*()` callbacks |
| **Response Contract** | Telemetry records appended to replay log |
| **Authentication** | Filesystem append access |
| **Runtime Expectations** | Synchronous writes. Zero HTTP calls. Zero middleware. Zero response modification. |
| **Failure Behaviour** | Write failure is caught and logged. Does not affect execution flow. |
| **Replay Behaviour** | Telemetry events are part of the replay chain. All tagged passive:true. |
| **Observability Signals** | Self-emitting. Schema-compliant events. |

**Files**: `services/observability/telemetry_emitter.js`, `trace_collector.js`, `replay_hooks.js`, `schema.json`

---

### 3.11 Survivability Tests

| Field | Value |
|---|---|
| **Purpose** | Verify system survives failures. 13 scenarios (7 core + 6 degraded). |
| **Interface** | Node.js scripts (CLI) |
| **Request Contract** | `node test_suite.js --proof`, `node degraded_survivability.js` |
| **Response Contract** | JSON proof artifacts in `proof/` directory |
| **Authentication** | None |
| **Runtime Expectations** | Run after services are started. ~3s for simulated, ~60s for lifecycle. |
| **Failure Behaviour** | Test failures reported in proof artifacts. |
| **Replay Behaviour** | Tests verify replay chain survives restarts and corruption. |
| **Observability Signals** | Proof artifacts: `survivability_proof.json`, `degraded_survivability_proof.json`, `ecosystem_proof.json` |

**Files**: `services/survivability_tests/test_suite.js`, `degraded_survivability.js`, `ecosystem_proof.js`, `scenarios.js`

---

### 3.12 Logstash / Fluentd / Loki (External, Compatible)

| Field | Value |
|---|---|
| **Purpose** | Consume TANTRA telemetry for external observability pipelines. |
| **Interface** | File read of `services/replay_persistence/data/replay_log.jsonl` |
| **Request Contract** | JSONL file, one JSON object per line |
| **Response Contract** | N/A (passive consumer) |
| **Authentication** | Filesystem access |
| **Runtime Expectations** | File grows monotonically. No rotation. |
| **Failure Behaviour** | Consumer responsibility. TANTRA does not detect read failures. |
| **Replay Behaviour** | Events are immutable after append. |
| **Observability Signals** | N/A (consumer, not emitter) |

**Compatibility**: See `tantra_gated_bridge/ECOSYSTEM_ALIGNMENT_NOTE.md` §3.1

---

### 3.13 Monitoring Systems (External, Compatible)

| Field | Value |
|---|---|
| **Purpose** | Poll service health for alerting and dashboarding. |
| **Interface** | HTTP GET on ports 3000-3005 |
| **Request Contract** | `GET /health` |
| **Response Contract** | `{"service", "status", "algorithms"}` |
| **Authentication** | None |
| **Runtime Expectations** | <10ms response. Process-level health check. |
| **Failure Behaviour** | Connection refused if service down. |
| **Replay Behaviour** | Not applicable. |
| **Observability Signals** | Health endpoint itself. |

---

## 4. Contract Registry

| Contract ID | Domain | Participants | Verification |
|---|---|---|---|
| OBS-CORE-001 | Observability | Bridge, Execution → Observability | Automated (ecosystem_proof.js) |
| OBS-CORE-002 | Observability | Bridge, Execution → Observability | Manual source audit |
| TEL-EXPORT-001 | Telemetry Export | Observability → External | Automated (ecosystem_proof.js) |
| TRC-CONT-001 | Trace Continuity | Replay Persistence | Automated (chain validation) |
| TRC-CONT-002 | Trace Continuity | Replay Reconstruction | Source code audit |
| REP-COMPAT-001 | Replay Compatibility | Replay Persistence | Automated (hash check) |
| REP-COMPAT-002 | Replay Compatibility | Replay Reconstruction | Manual review |

See `tantra_gated_bridge/docs/ECOSYSTEM_PARTICIPATION.md` for full contract details.

---

## 5. Data Flow Diagram

```
                        ┌──────────────────────┐
                        │   Setu (:8000)        │  Inbound workload
                        └──────────┬───────────┘
                                   │
                        ┌──────────▼───────────┐
                        │   Core (:3000)        │  UUID generation
                        └──────────┬───────────┘
                                   │
                        ┌──────────▼───────────┐
                        │   Sarathi (:3001)     │  JWT issuance
                        └──────────┬───────────┘
                                   │
                        ┌──────────▼───────────┐
                        │   Bridge (:3002)      │  Validation + forwarding
                        └──────────┬───────────┘
                                   │
                  ┌────────────────┼────────────────┐
                  │                │                 │
     ┌────────────▼──────┐  ┌─────▼──────────┐  ┌──▼──────────────┐
     │ Execution (:3003) │  │ Replay         │  │ Observability   │
     │                   │  │ Persistence    │  │ Modules         │
     └────────┬──────────┘  └────────────────┘  └─────────────────┘
              │
     ┌────────▼──────────┐
     │ Bucket (:3004)    │  Artifact storage
     └────────┬──────────┘
              │
     ┌────────▼──────────────────────┐
     │ External Consumers            │
     │ (Logstash, Fluentd, Loki,    │
     │  Monitoring, analysts)        │
     └───────────────────────────────┘
```

---

## References

| Document | Location |
|---|---|
| Ecosystem Contracts | `tantra_gated_bridge/docs/ECOSYSTEM_PARTICIPATION.md` |
| Ecosystem Alignment | `tantra_gated_bridge/ECOSYSTEM_ALIGNMENT_NOTE.md` |
| Capability Definition | `CAPABILITY_DEFINITION.md` |
| Attachment Guide | `docs/ATTACHMENT_GUIDE.md` |
| Consumer Guide | `docs/CONSUMER_GUIDE.md` |
| API Reference | `docs/API.md` |
