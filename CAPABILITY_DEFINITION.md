# TANTRA Gated Bridge — Capability Definition

**Version:** 1.0.0  
**Date:** 2026-07-07  
**Status:** Registered  
**Capability ID:** `tantra-gated-bridge-v1`

---

## 1. Capability Metadata

| Field | Value |
|---|---|
| **Capability Name** | TANTRA Gated Bridge |
| **Capability ID** | `tantra-gated-bridge-v1` |
| **Version** | 1.0.0 |
| **Classification** | Infrastructure — Distributed Execution Pipeline |
| **Domain** | Domain 3 — Secure Workload Execution |
| **Owner** | TANTRA Platform Team |
| **Registry** | TANTRA Capability Registry |

---

## 2. Capability Description

The TANTRA Gated Bridge is a zero-trust, hard-fail distributed execution pipeline that routes workload execution through a chain of narrowly-scoped microservices. Each service validates JWT tokens from a central authority (Sarathi), enforces immutable identity propagation, and rejects any deviation from the established trust chain.

The capability provides:
- **Secure workload initiation** with traceable identity propagation
- **Zero-trust JWT validation** at every service hop
- **Replay attack prevention** via append-only JTI tracking
- **Immutable audit trail** with SHA-256 hash chain integrity
- **Pluggable execution** via adapter pattern
- **Persistent artifact storage** with read-after-write verification

---

## 3. Inputs

| Input | Type | Required | Description |
|---|---|---|---|
| `workload` | string | Yes | Workload identifier or payload to execute |
| `action` | string | No | Optional action modifier |
| `payload` | object | No | Optional additional data for execution |

### Input Schema (POST /initiate)

```json
{
  "workload": "string (required)",
  "action": "string (optional)",
  "payload": {} (optional)
}
```

---

## 4. Outputs

| Output | Type | Description |
|---|---|---|
| `trace_id` | UUID | Immutable trace identifier across all services |
| `execution_id` | UUID | Immutable execution identifier |
| `cet_hash` | string | SHA-256 hash of trace_id:execution_id |
| `status` | string | Execution status (completed/error) |
| `result` | object | Execution result payload |
| `artifact_location` | string | Bucket storage location |
| `duration_ms` | number | Execution duration in milliseconds |

### Output Schema (POST /initiate Response)

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

---

## 5. Dependencies

| Dependency | Type | Required | Description |
|---|---|---|---|
| Node.js 18+ | Runtime | Yes | JavaScript runtime |
| npm | Package Manager | Yes | Node.js package manager |
| SQLite (better-sqlite3) | Storage | Yes | Bucket artifact storage |
| Express.js | Framework | Yes | HTTP server framework |
| jsonwebtoken | Library | Yes | JWT verification (RS256) |
| axios | Library | Yes | HTTP client for inter-service calls |

### Service Dependencies

```
Core → Sarathi (token request)
Bridge → Sarathi (JWKS fetch)
Bridge → Execution (forward workload)
Execution → Bucket (store artifact)
Execution → InsightFlow (telemetry, async)
```

---

## 6. Authority Limits

| Authority | Scope | Limit |
|---|---|---|
| **Token Issuance** | Sarathi only | No other service may issue JWT tokens |
| **Token Validation** | Bridge + Execution | Validate only, never generate |
| **Workload Execution** | Execution only | Execute workloads, store artifacts |
| **Artifact Storage** | Bucket only | Persist artifacts with verification |
| **Trace Propagation** | All services | Immutable trace_id/execution_id |
| **Replay Detection** | Bridge only | jti-based replay rejection |
| **Telemetry** | InsightFlow (async) | Passive observation, no execution authority |

### Constitutional Boundaries

1. **Bridge has ZERO authority** — cannot sign tokens, execute workloads, or store artifacts
2. **No fallback paths** — any dependency failure stops the system (hard-fail)
3. **No local token minting** — Bridge never generates JWT tokens
4. **Immutable IDs** — trace_id/execution_id cannot be mutated after generation
5. **Replay protection** — every JWT is single-use (jti tracked in append-only log)

---

## 7. Attachment Rules

| Rule | Description |
|---|---|
| **Execution Participant** | Set `EXECUTION_PARTICIPANT` env var to custom workload handler |
| **InsightFlow Endpoint** | Set `INSIGHTFLOW_URL` to external telemetry receiver |
| **JWT Algorithm** | Default EdDSA; RS256 supported for backward compatibility |
| **JWKS Cache TTL** | Configurable via `JWKS_CACHE_TTL_MS` (default: 300000ms) |

### Custom Execution Participant

```javascript
// execution_participant.js
module.exports = {
  async executeWorkload(workload, trace_id, execution_id) {
    // Your custom workload logic
    return { workload, output: "custom result", trace_id, execution_id };
  }
};
```

---

## 8. Consumers

| Consumer | Protocol | Description |
|---|---|---|
| External API Clients | HTTP POST | Submit workloads via Core endpoint |
| Internal Services | HTTP | Inter-service JWT-authenticated calls |
| Observability Stack | Async | InsightFlow telemetry ingestion |
| Monitoring Systems | HTTP | Health check endpoints on all services |

---

## 9. Version History

| Version | Date | Changes |
|---|---|---|
| 1.0.0 | 2026-07-07 | Initial capability registration. 6 services operational, 99/99 tests pass, full documentation. |

---

## 10. Registration Document

This capability is registered in the TANTRA Capability Registry as:

```
Capability ID:    tantra-gated-bridge-v1
Capability Name:  TANTRA Gated Bridge
Version:          1.0.0
Domain:           Domain 3 — Secure Workload Execution
Status:           ACTIVE
Registered:       2026-07-07
```

---

## 11. Future Attachment Examples

### Example 1: Custom Execution Participant

```bash
# Set custom execution handler
export EXECUTION_PARTICIPANT=./my_custom_handler.js

# Start execution service
cd services/execution && node app.js
```

### Example 2: External InsightFlow Integration

```bash
# Configure external telemetry endpoint
export INSIGHTFLOW_URL=https://insightflow.example.com/api/v1/telemetry
export INSIGHTFLOW_API_KEY=your-api-key
export INSIGHTFLOW_ENABLED=true

# Start bridge with telemetry forwarding
cd services/bridge && node app.js
```

### Example 3: Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tantra-core
spec:
  replicas: 3
  selector:
    matchLabels:
      app: tantra-core
  template:
    spec:
      containers:
      - name: core
        image: tantra/core:1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: SARATHI_URL
          value: "http://tantra-sarathi:3001"
        - name: BRIDGE_URL
          value: "http://tantra-bridge:3002"
```

---

## 12. Acceptance Criteria

| # | Criterion | Status |
|---|---|---|
| 1 | All 6 services healthy (3000-3005) | ✅ Met |
| 2 | End-to-end workflow executes successfully | ✅ Met |
| 3 | trace_id/execution_id immutable across all services | ✅ Met |
| 4 | Replay protection blocks token reuse (HTTP 401) | ✅ Met |
| 5 | Bucket persistence verified (SQLite + SHA-256) | ✅ Met |
| 6 | Graceful shutdown supported (SIGTERM) | ✅ Met |
| 7 | Key persistence across restarts | ✅ Met |
| 8 | Chain integrity validated (437+ records) | ✅ Met |
| 9 | 99/99 tests pass | ✅ Met |
| 10 | Docker deployment configured | ✅ Met |
| 11 | Documentation complete (9 docs) | ✅ Met |
| 12 | Review packet complete | ✅ Met |

**Capability Status: REGISTERED AND ACCEPTED**
