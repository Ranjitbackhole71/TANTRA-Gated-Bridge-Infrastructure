# LIVE EXECUTION PROOF

## Test Date
2026-05-11

## Environment
```
Platform: Windows
Node: v24.15.0
Services: 5 (ports 3000-3004)
```

---

## 1. Successful End-to-End Flow

### Request
```bash
curl -s -X POST http://localhost:3000/initiate \
  -H "Content-Type: application/json" \
  -d '{"workload":"e2e-proof"}'
```

### Response (200)
```json
{
  "trace_id": "bd86c552-5e1f-4fa2-b304-3f4238340ca1",
  "execution_id": "bdf633a6-24b7-4e7c-bf7d-45bc4e8469ae",
  "status": "completed",
  "result": {
    "trace_id": "bd86c552-5e1f-4fa2-b304-3f4238340ca1",
    "execution_id": "bdf633a6-24b7-4e7c-bf7d-45bc4e8469ae",
    "status": "completed",
    "result": {
      "workload": "e2e-proof",
      "output": "Processed e2e-proof",
      "trace_id": "bd86c552-5e1f-4fa2-b304-3f4238340ca1",
      "execution_id": "bdf633a6-24b7-4e7c-bf7d-45bc4e8469ae"
    },
    "artifact_location": "artifacts/bd86c552-5e1f-4fa2-b304-3f4238340ca1/bdf633a6-24b7-4e7c-bf7d-45bc4e8469ae",
    "duration_ms": 109
  }
}
```

### Flow Path
```
Core (3000)
  └─ POST /initiate → generates trace_id + execution_id
  └─ POST /token → Sarathi (3001) → returns JWT
  └─ POST /execute → Bridge (3002)
       └─ validates JWT (issuer, expiry, signature, jti)
       └─ POST /run → Execution (3003)
            └─ validates bridge signature
            └─ executes workload
            └─ POST /store → Bucket (3004)
                 └─ stores artifact in SQLite
                 └─ read-after-write verification
                 └─ SHA-256 hash computed
                 └─ returns 201 with hash
  └─ returns 200 to caller
```

### Trace Integrity
| Service | trace_id | execution_id | Match |
|---------|----------|-------------|-------|
| Core (response) | bd86c552... | bdf633a6... | ✅ |
| Sarathi (token) | bd86c552... | bdf633a6... | ✅ |
| Bridge (forward) | bd86c552... | bdf633a6... | ✅ |
| Execution (result) | bd86c552... | bdf633a6... | ✅ |
| Bucket (stored) | bd86c552... | bdf633a6... | ✅ |

---

## 2. Failure Propagation — Invalid Token

### Request
```bash
curl -s -X POST http://localhost:3002/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid.jwt.here" \
  -d '{"workload":"fail-test","trace_id":"t1","execution_id":"e1"}'
```

### Response (401)
```json
{
  "error": "Unauthorized: Invalid token"
}
```

**Propagation**: jwt.verify throws → Bridge catches → Returns 401 → No execution attempted.

---

## 3. Failure Propagation — ID Mutation

### Step 1: Generate Token
```bash
curl -s -X POST http://localhost:3001/token \
  -H "Content-Type: application/json" \
  -d '{"trace_id":"real-id","execution_id":"real-eid"}'
```

### Step 2: Call Bridge with Mutated trace_id
```bash
curl -s -X POST http://localhost:3002/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"workload":"mut-test","trace_id":"FAKE-ID","execution_id":"real-eid"}'
```

### Response (400)
```json
{
  "error": "trace_id mutation forbidden"
}
```

**Propagation**: enforceImmutableIds detects mismatch → Returns 400 → No forwarding.

---

## 4. Health Endpoint Verification

| Port | Service | Response | Status |
|------|---------|----------|--------|
| 3000 | Core | `{"service":"core","status":"healthy"}` | ✅ |
| 3001 | Sarathi | `{"service":"sarathi","status":"healthy","issuer":"tantra-sarathi"}` | ✅ |
| 3002 | Bridge | `{"service":"bridge","status":"healthy"}` | ✅ |
| 3003 | Execution | `{"service":"execution","status":"healthy"}` | ✅ |
| 3004 | Bucket | `{"service":"bucket","status":"healthy"}` | ✅ |

---

## 5. Bucket Persistence Verification

### Retreive Stored Artifact
```bash
curl -s http://localhost:3004/retrieve/bd86c552-5e1f-4fa2-b304-3f4238340ca1/bdf633a6-24b7-4e7c-bf7d-45bc4e8469ae
```

### Response
```json
{
  "trace_id": "bd86c552-5e1f-4fa2-b304-3f4238340ca1",
  "execution_id": "bdf633a6-24b7-4e7c-bf7d-45bc4e8469ae",
  "result": {
    "workload": "e2e-proof",
    "output": "Processed e2e-proof",
    "trace_id": "bd86c552-5e1f-4fa2-b304-3f4238340ca1",
    "execution_id": "bdf633a6-24b7-4e7c-bf7d-45bc4e8469ae"
  },
  "timestamp": "2026-05-11T09:36:09.591Z",
  "duration_ms": 109,
  "stored_at": "2026-05-11T09:36:09.593Z",
  "hash": "f2ecbc9f1545289d6a34b698fdec4b5e7a5ad1a6697c1bdff94b66dca48e71e8"
}
```

### Database File
```
Path: services/bucket/bucket.db
Exists: ✅ (SQLite, persistent)
Size: 12,288 bytes
```

---

## 6. Service Isolation

All 5 services run as separate Node.js processes on distinct ports:

| Service | Port | PID (current) |
|---------|------|---------------|
| Core | 3000 | 10916 |
| Sarathi | 3001 | 13728 |
| Bridge | 3002 | 5556 |
| Execution | 3003 | 11308 |
| Bucket | 3004 | 17060 |

---

## VERDICT

```
╔══════════════════════════════════════════════╗
║  LIVE EXECUTION: ✅ ALL TESTS PASSED         ║
╠══════════════════════════════════════════════╣
║  1. Full E2E workflow — completed (200)     ║
║  2. Invalid token blocked (401)             ║
║  3. ID mutation blocked (400)               ║
║  4. All health endpoints responding         ║
║  5. Bucket persistence verified (SQLite)    ║
║  6. Trace IDs immutable across 5 services   ║
╚══════════════════════════════════════════════╝
```
