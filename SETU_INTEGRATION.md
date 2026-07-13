# Setu — User-Facing Product Integration with TANTRA Runtime

**Version**: 1.0.0
**Date**: 2026-07-13
**Status**: Operational — Full Lifecycle Verified

---

## Overview

**Setu** (Sanskrit: "bridge/connection") is the user-facing product that bridges real user requests to the complete TANTRA runtime lifecycle. It proves that a real product can consume the runtime and produce a complete input-to-output lifecycle.

### Why Setu?

- Neither **Setu** nor **Samruddhi** existed in the repository prior to this integration.
- The existing `app/main.py` (FastAPI AI Agent) talked directly to Bucket, **bypassing** the TANTRA runtime chain.
- Setu was created as the **smallest possible demonstration application** that routes through the complete runtime.

---

## Architecture

```
User
  │
  ▼
Setu (:8000)          ← User-facing FastAPI product
  │
  ▼
Core (:3000)          ← Generates trace_id, execution_id, cet_hash
  │
  ▼
Sarathi (:3001)       ← Issues JWT (RS256/EdDSA)
  │
  ▼
Bridge (:3002)        ← Validates JWT, enforces ID immutability
  │
  ▼
Execution (:3003)     ← Runs workload via execution_participant
  │
  ├──▶ Bucket (:3004)         ← Stores artifact with SHA-256 hash
  ├──▶ Replay Persistence     ← Append-only store with hash chain
  └──▶ InsightFlow (:3005)    ← Telemetry ingestion
  │
  ▼
Setu → User           ← Returns complete response
```

---

## Setu Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API information and documentation |
| `/health` | GET | Health check — verifies connectivity to all TANTRA services |
| `/process` | POST | **Main endpoint** — processes user request through complete runtime |
| `/artifact/{trace_id}/{execution_id}` | GET | Retrieve stored artifact from Bucket |
| `/telemetry/{trace_id}` | GET | Get InsightFlow telemetry for a specific trace |
| `/telemetry` | GET | Get InsightFlow telemetry summary |

---

## Request Lifecycle

### 1. User sends request to Setu

```bash
curl -X POST http://localhost:8000/process \
  -H "Content-Type: application/json" \
  -d '{"workload": "Analyze quarterly sales data"}'
```

### 2. Setu forwards to Core

Setu assigns a `setu_request_id` and forwards the workload to Core `/initiate`.

### 3. Core orchestrates the runtime

- Generates `trace_id` (UUID) and `execution_id` (UUID)
- Computes `cet_hash` = SHA-256(trace_id + ":" + execution_id)
- Requests JWT from Sarathi
- Forwards to Bridge with JWT in Authorization header

### 4. Sarathi issues JWT

- Signs claims with RS256 or EdDSA algorithm
- Claims include: trace_id, execution_id, iss, aud, jti, iat, exp, cet_hash

### 5. Bridge validates and forwards

- Validates JWT via JWKS with kid resolution
- Enforces immutable trace_id, execution_id, cet_hash
- Checks JTI for replay attacks
- Forwards to Execution

### 6. Execution runs workload

- Validates Bridge signature via JWKS
- Enforces ID immutability
- Executes workload via `execution_participant.js`
- Stores artifact in Bucket

### 7. Bucket persists artifact

- SQLite-backed storage with read-after-write verification
- SHA-256 hash integrity check
- Returns artifact location and hash

### 8. Replay Persistence records events

- Append-only JSONL store with SHA-256 hash chain
- Records: jti_used, execution_transition, response_sent, etc.

### 9. InsightFlow receives telemetry

- Passive telemetry ingestion on port 3005
- Events forwarded from Bridge and Execution via adapter

### 10. Setu returns response to user

```json
{
  "status": "completed",
  "trace_id": "094eaf37-ded6-454d-8abd-125245271105",
  "execution_id": "6af58c98-c459-4951-952c-322ff1258e12",
  "cet_hash": "e701f27aff2e25643ed00f5c0ddc50e165327cf6dbb7e9c47f79393d2c0d14a7",
  "result": { ... },
  "artifact_location": "artifacts/...",
  "duration_ms": 203,
  "runtime_chain": ["setu","core","sarathi","bridge","execution","bucket","replay_persistence","insightflow"],
  "setu_request_id": "dff9dcf493bf3051",
  "timestamp": "2026-07-13T06:46:37.210Z"
}
```

---

## Files Created/Modified

### Created
| File | Purpose |
|------|---------|
| `setu/app.py` | FastAPI application — user-facing product |
| `setu/requirements.txt` | Python dependencies |
| `setu/.env` | Configuration (ports, URLs) |

### Modified
| File | Change |
|------|--------|
| `services/bridge/.env` | Added `INSIGHTFLOW_ENABLED=true` and `INSIGHTFLOW_URL` |
| `services/execution/.env` | Added `INSIGHTFLOW_ENABLED=true` and `INSIGHTFLOW_URL` |

---

## Verification Evidence

### Test 1 (2026-07-13T06:46:37Z)

| Metric | Value |
|--------|-------|
| trace_id | `094eaf37-ded6-454d-8abd-125245271105` |
| execution_id | `6af58c98-c459-4951-952c-322ff1258e12` |
| cet_hash | `e701f27aff2e25643ed00f5c0ddc50e165327cf6dbb7e9c47f79393d2c0d14a7` |
| status | completed |
| duration_ms | 203 |
| Bucket hash | `ead898fbfc8ce3c7f0d3b596a747a6b947bf0e7d6612bf0b9b6fc78eb4ca7a0a` |
| Replay records | 9 (jti_used + 7 telemetry + response_sent) |

### Test 2 (Reproducibility)

| Metric | Value |
|--------|-------|
| trace_id | `723e170d-0969-4d84-8fcf-26a33057fc0e` |
| execution_id | `258564cc-1e48-4b2b-94e2-704ac6ac6b28` |
| status | completed |
| duration_ms | 47 |
| Replay records | 9 additional |
| Total chain records | 564 |

### Runtime Chain Participants Exercised

| # | Participant | Verified |
|---|-------------|----------|
| 1 | Setu (user-facing) | POST /process → 200 OK |
| 2 | Core | trace_id + execution_id + cet_hash generated |
| 3 | Sarathi | JWT issued (EdDSA) |
| 4 | Bridge | JWT validated, IDs enforced, forwarded |
| 5 | Execution | Workload executed via participant |
| 6 | Bucket | Artifact stored with SHA-256 |
| 7 | Replay Persistence | 9 events in append-only store |
| 8 | InsightFlow | Local receiver operational |

---

## How to Reproduce

### Prerequisites
- Node.js 18+
- Python 3.12+
- All TANTRA services installed (npm install in each service directory)

### Steps

1. **Start all TANTRA services:**
   ```bash
   cd services/core && node app.js &
   cd services/sarathi && node app.js &
   cd services/bridge && node app.js &
   cd services/execution && node app.js &
   cd services/bucket && node app.js &
   cd services/insightflow && node local_receiver.js &
   ```

2. **Start Setu:**
   ```bash
   cd setu
   python -m uvicorn app:app --host 0.0.0.0 --port 8000
   ```

3. **Send a user request:**
   ```bash
   curl -X POST http://localhost:8000/process \
     -H "Content-Type: application/json" \
     -d '{"workload": "Your task here"}'
   ```

4. **Verify the response** contains trace_id, execution_id, artifact_location, and runtime_chain.

5. **Check replay persistence:**
   ```bash
   cat services/replay_persistence/data/replay_log.jsonl | tail -10
   ```

6. **Check InsightFlow telemetry:**
   ```bash
   curl http://localhost:3005/telemetry/{trace_id}
   ```
