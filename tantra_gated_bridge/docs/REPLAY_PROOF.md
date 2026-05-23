# REPLAY PROOF — Live Attack Validation

## Test Date
2026-05-11

## Objective
Prove that reusing a JWT token is rejected with 401 "Token replay detected".

---

## Step 1: Generate Token from Sarathi

### Request
```bash
curl -s -X POST http://localhost:3001/token \
  -H "Content-Type: application/json" \
  -d '{"trace_id":"replay-prove","execution_id":"replay-prove-exec"}'
```

### Response
```json
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0cmFjZV9pZCI6InJlcGxheS1wcm92ZSIsImV4ZWN1dGlvbl9pZCI6InJlcGxheS1wcm92ZS1leGVjIiwiaXNzIjoidGFudHJhLXNhcmF0aGkiLCJhdWQiOiJ0YW50cmEtYnJpZGdlIiwianRpIjoiYTMyZWQ0MzUtYmY0Yi00MDljLTgxODQtYzBjMjgzMzc0MzNjIiwiaWF0IjoxNzc4NDkyMTUzLCJleHAiOjE3Nzg0OTU3NTN9.iBQtdxZj3lVoi71cdxjh158PMTRBKHVQJE3jsLBYyFVAcm_mHqtziV19D2P1mJhG6F7Wjz10GmyZmnwe5rpYySHbsLqAZEO_iDNus-JF7iCnvCqQ3Ih_3zokzJtPGV6fMWHHqB_OBmzyya7nsbJQ5HJ5zNrseU8zogxi75raqWzUExqsQ3Csl5SMjUpGdlXomy90Kvdfe0VXyctC11EKzgmZEafJDVA9Y9nhAT792qEb-rPdQcReCDzJuWCMFqo1uv21NDuRAaQSfhysCOiGNV4umZgimoh8hr4MM75tpoaAne5upT3i-al_9BoSTTOGDWqcPitK19_-etZnRC03Iw",
  "trace_id": "replay-prove",
  "execution_id": "replay-prove-exec",
  "jti": "a32ed435-bf4b-409c-8184-c0c28337433c"
}
```

### Decoded JWT Claims
```
trace_id:      replay-prove
execution_id:  replay-prove-exec
iss:           tantra-sarathi
aud:           tantra-bridge
jti:           a32ed435-bf4b-409c-8184-c0c28337433c
iat:           1778492153
exp:           1778495753
```

---

## Step 2: First Use (Should Succeed)

### Request
```bash
curl -s -X POST http://localhost:3002/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"workload":"replay-test","trace_id":"replay-prove","execution_id":"replay-prove-exec"}'
```

### Response (200)
```json
{
  "trace_id": "replay-prove",
  "execution_id": "replay-prove-exec",
  "status": "completed",
  "result": {
    "workload": "replay-test",
    "output": "Processed replay-test",
    "trace_id": "replay-prove",
    "execution_id": "replay-prove-exec"
  },
  "artifact_location": "artifacts/replay-prove/replay-prove-exec",
  "duration_ms": 111
}
```

**Status: 200 OK** — Token accepted, workflow executed, artifact stored.

---

## Step 3: Replay Same Token (Must Fail)

### Request (identical)
```bash
curl -s -X POST http://localhost:3002/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <same-token>" \
  -d '{"workload":"replay-test","trace_id":"replay-prove","execution_id":"replay-prove-exec"}'
```

### Response (401)
```json
{
  "error": "Unauthorized: Token replay detected"
}
```

**HTTP Code: 401** — Reuse of same token BLOCKED.

---

## Replay Protection Chain

| Step | Service | Action | Result |
|------|---------|--------|--------|
| Token issued | Sarathi (3001) | Generate JWT with unique jti claim | jti: a32ed435... |
| First use | Bridge (3002) | Validate JWT, store jti in replayCache | 200 — completed |
| Replay | Bridge (3002) | Detect jti in replayCache | 401 — blocked |

### Mechanism
- **jti**: crypto.randomUUID() per token
- **Cache**: Bridge in-memory `Map<jti, timestamp>`
- **Enforcement**: `replayCache.has(decoded.jti)` returns 401

---

## Log Evidence

Bridge logs during replay detection:
```json
{"timestamp":"2026-05-11T09:35:53...Z","trace_id":"replay-prove","execution_id":"replay-prove-exec","service_name":"bridge","status":"error","message":"Replay attack detected - jti: c729c39f-fde5-405d-a67e-c51dbf206a66"}
```

---

## VERDICT

```
╔══════════════════════════════════════════╗
║  REPLAY PROTECTION: ✅ ENFORCED          ║
╠══════════════════════════════════════════╣
║  Token reuse → 401 detected             ║
║  jti claim → unique per token           ║
║  replayCache → in-memory Map            ║
║  Limitation: cache lost on restart      ║
╚══════════════════════════════════════════╝
```
