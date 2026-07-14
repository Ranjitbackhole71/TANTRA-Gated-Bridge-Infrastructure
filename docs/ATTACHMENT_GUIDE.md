# TANTRA Gated Bridge — Attachment Guide

**Version**: 1.0.0
**Date**: 2026-07-14

---

## 1. Overview

This guide documents how external systems attach to the TANTRA Gated Bridge pipeline. TANTRA participates in the ecosystem as a **passive observable participant** — it emits telemetry and accepts workloads, but does not accept remote control or governance commands.

See also: `ECOSYSTEM_PARTICIPATION.md` for contract IDs and `ECOSYSTEM_ALIGNMENT_NOTE.md` for compatibility.

---

## 2. Attachment Points

| # | Attachment Point | Protocol | Direction | Purpose |
|---|---|---|---|---|
| 1 | Workload Submission | HTTP POST | Inbound | Submit workloads via Core endpoint |
| 2 | Telemetry Consumption | File read | Outbound | Read replay log for observability |
| 3 | Health Monitoring | HTTP GET | Outbound | Poll service health endpoints |
| 4 | Trace Reconstruction | Node.js require() | Outbound | Programmatic trace reconstruction |
| 5 | Artifact Retrieval | HTTP GET | Outbound | Retrieve stored execution artifacts |
| 6 | JWKS Discovery | HTTP GET | Outbound | Fetch JWT public keys |

---

## 3. Attachment 1: Workload Submission

### Purpose

Submit workloads to TANTRA for execution through the full pipeline.

### Interface

```
POST http://localhost:3000/initiate
Content-Type: application/json
```

### Request Contract

```json
{
  "workload": "string (required)",
  "action": "string (optional)",
  "payload": {} (optional)
}
```

### Response Contract

```json
{
  "trace_id": "uuid",
  "execution_id": "uuid",
  "cet_hash": "sha256-hex",
  "status": "completed",
  "result": {
    "workload": "string",
    "output": "string",
    "trace_id": "uuid",
    "execution_id": "uuid"
  },
  "artifact_location": "artifacts/{trace_id}/{execution_id}",
  "duration_ms": 101
}
```

### Authentication

None (internal network). For external access, add a reverse proxy with TLS.

### Runtime Expectations

- Response time: 1-200ms (depends on workload complexity)
- Core is always available if running
- Sarathi must be running for JWT issuance

### Failure Behaviour

| Failure | HTTP Code | Response |
|---|---|---|
| Sarathi unavailable | 503 | `{"error": "System stopped: dependency unavailable"}` |
| Bridge unavailable | 503 | `{"error": "System stopped: dependency unavailable"}` |
| Execution unavailable | 503 | `{"error": "System stopped: dependency unavailable"}` |
| Bucket unavailable | 503 | `{"error": "System stopped: dependency unavailable"}` |

### Replay Behaviour

Each workload submission generates a unique `trace_id` and `execution_id`. The JWT token used is single-use (jti tracked in append-only log). Duplicate token submissions are rejected with HTTP 401.

### Observability Signals

- Telemetry event `telemetry:request_received` emitted at Bridge ingress
- Telemetry event `telemetry:execution_transition` emitted on state change
- Telemetry event `telemetry:response_sent` emitted on completion
- All events tagged `passive: true`

---

## 4. Attachment 2: Telemetry Consumption

### Purpose

Read structured telemetry events from the append-only replay log for external observability pipelines.

### Interface

```
File: services/replay_persistence/data/replay_log.jsonl
Format: JSON Lines (one JSON object per line)
```

### Request Contract

Read the file using any JSONL-compatible reader (Filebeat, Fluentd, Logstash, custom script).

### Response Contract

Each line is a JSON object:

```json
{
  "trace_id": "uuid",
  "execution_id": "uuid|null",
  "event_type": "telemetry:<type>",
  "service": "string",
  "status": "string",
  "payload": {
    "telemetry": true,
    "passive": true,
    ...
  },
  "timestamp": "ISO8601",
  "hash": "sha256",
  "previous_hash": "sha256|null",
  "sequence": 123
}
```

### Supported Event Types

| Event Type | Description |
|---|---|
| `telemetry:request_received` | Bridge ingress |
| `telemetry:execution_transition` | State change |
| `telemetry:rejection` | Validation failure |
| `telemetry:dependency_failure` | Service unavailable |
| `telemetry:response_sent` | Response to Core |
| `telemetry:replay_verification` | Verification run |

### Authentication

Filesystem read access. No API authentication required.

### Runtime Expectations

- File grows monotonically (append-only)
- No log rotation currently implemented
- Records are immutable after append

### Failure Behaviour

Read failures are the consumer's responsibility. TANTRA does not detect or respond to read failures.

### Replay Behaviour

The replay log itself is the replay record. All events are deterministic and reconstructable.

### Observability Signals

- All telemetry events contain `payload.passive: true` (contract OBS-CORE-001)
- No telemetry event has execution authority (contract OBS-CORE-002)

---

## 5. Attachment 3: Health Monitoring

### Purpose

Poll service health for monitoring and alerting.

### Interface

```
GET http://localhost:{port}/health
```

### Ports

| Service | Port |
|---|---|
| Core | 3000 |
| Sarathi | 3001 |
| Bridge | 3002 |
| Execution | 3003 |
| Bucket | 3004 |
| InsightFlow (local) | 3005 |

### Response Contract

```json
{
  "service": "string",
  "status": "healthy",
  "algorithms": ["RS256", "EdDSA"]  // Sarathi, Bridge, Execution only
}
```

### Authentication

None.

### Runtime Expectations

- Response time: <10ms
- Health endpoint is always available if service process is running

### Failure Behaviour

- Service down: connection refused
- Service unhealthy: still returns 200 with `status: "healthy"` (health check is process-level, not dependency-level)

### Replay Behaviour

Not applicable.

### Observability Signals

Not applicable (health endpoint does not emit telemetry).

---

## 6. Attachment 4: Trace Reconstruction

### Purpose

Programmatically reconstruct execution traces from the replay log.

### Interface

```javascript
const reconstruction = require('./services/replay_reconstruction/reconstruction_tool');

// Single execution
const result = reconstruction.reconstructExecution(traceId, executionId);

// Full trace
const trace = reconstruction.reconstructTrace(traceId);

// Time range
const range = reconstruction.reconstructByTimeRange(startTime, endTime);

// Verification
const verification = reconstruction.verifyReconstructable(traceId);
```

### Request Contract

| Function | Parameters | Returns |
|---|---|---|
| `reconstructExecution` | `traceId: string, executionId: string` | `{found, trace_id, execution_id, events, continuity}` |
| `reconstructTrace` | `traceId: string` | `{found, trace_id, executions, lineage, continuity}` |
| `reconstructByTimeRange` | `startTime: ISO8601, endTime: ISO8601` | `{traces: [...]}` |
| `verifyReconstructable` | `traceId: string` | `{reconstructable, chain_valid, continuity_valid}` |

### Response Contract

See `replay_reconstruction/reconstruction_tool.js` for full schema.

### Authentication

Filesystem read access.

### Runtime Expectations

- Read-only: never modifies replay log
- Deterministic: same inputs produce identical outputs
- Performance: <100ms for traces with <1000 events

### Failure Behaviour

Returns `{found: false}` for unknown trace IDs. Never throws.

### Replay Behaviour

Reconstruction is fully deterministic (contract TRC-CONT-001).

### Observability Signals

Not applicable (read-only operation, no telemetry emitted).

---

## 7. Attachment 5: Artifact Retrieval

### Purpose

Retrieve stored execution artifacts from the Bucket service.

### Interface

```
GET http://localhost:3004/retrieve/:trace_id/:execution_id
```

### Response Contract

```json
{
  "trace_id": "uuid",
  "execution_id": "uuid",
  "result": {},
  "timestamp": "iso8601",
  "duration_ms": 123,
  "stored_at": "iso8601",
  "hash": "sha256-hex"
}
```

### Authentication

None (internal network).

### Runtime Expectations

- Response time: <50ms
- Artifact must exist (stored during execution)

### Failure Behaviour

| Failure | HTTP Code | Response |
|---|---|---|
| Artifact not found | 404 | `{"error": "Artifact not found"}` |
| Bucket unavailable | 503 | Connection refused |

### Replay Behaviour

Not applicable.

### Observability Signals

Not applicable.

---

## 8. Attachment 6: JWKS Discovery

### Purpose

Fetch JWT public keys for external token verification.

### Interface

```
GET http://localhost:3001/.well-known/jwks.json
GET http://localhost:3001/jwks
```

### Response Contract

RFC 7517 compliant JWKS:

```json
{
  "keys": [
    {
      "kty": "OKP",
      "crv": "Ed25519",
      "x": "base64url",
      "alg": "EdDSA",
      "kid": "uuid",
      "use": "sig"
    },
    {
      "kty": "RSA",
      "n": "base64url",
      "e": "base64url",
      "alg": "RS256",
      "kid": "uuid",
      "use": "sig"
    }
  ]
}
```

### Authentication

None.

### Runtime Expectations

- Response time: <10ms
- JWKS is always available if Sarathi is running
- Keys change after rotation (rotate via `key_persistence.rotateKeys()`)

### Failure Behaviour

Sarathi down: connection refused. JWKS cache in Bridge falls back to stale keys (TTL-based).

### Replay Behaviour

Not applicable.

### Observability Signals

Not applicable.

---

## References

| Document | Location |
|---|---|
| Ecosystem Contracts | `tantra_gated_bridge/docs/ECOSYSTEM_PARTICIPATION.md` |
| Ecosystem Alignment | `tantra_gated_bridge/ECOSYSTEM_ALIGNMENT_NOTE.md` |
| Capability Definition | `CAPABILITY_DEFINITION.md` |
| API Reference | `docs/API.md` |
| Architecture | `docs/ARCHITECTURE.md` |
