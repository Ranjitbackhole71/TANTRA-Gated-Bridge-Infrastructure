# FAILURE PROOF - Executable Failure Demonstrations

## Overview
This document provides EXACT commands and expected outputs to prove system fails correctly under all failure conditions.

---

## Test 1: Sarathi Down → BLOCK

### Setup
```bash
# Stop Sarathi service
docker-compose stop sarathi
# OR kill the process
lsof -ti:3001 | xargs kill -9
```

### Exact Command
```bash
curl -s -X POST http://localhost:3000/initiate \
  -H "Content-Type: application/json" \
  -d '{"workload": "test-task"}' | jq .
```

### Expected HTTP Code
`503` or `500`

### Expected Response
```json
{
  "error": "System stopped: dependency unavailable",
  "trace_id": "uuid",
  "execution_id": "uuid"
}
```

### Expected Logs (Core)
```json
{"timestamp":"...","trace_id":"...","execution_id":"...","service_name":"core","status":"error","message":"Workflow failed: Request failed with status code 503"}
```

### Verification
```bash
# Check Core logs for BLOCK indication
# System must NOT generate fallback token
# System must NOT proceed to Bridge
```

### Teardown
```bash
docker-compose start sarathi
# OR restart service
cd services/sarathi && node app.js &
```

---

## Test 2: Invalid Token → BLOCK

### Setup
```bash
# Ensure services are running
docker-compose up -d
```

### Exact Command
```bash
curl -s -X POST http://localhost:3002/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid.jwt.token" \
  -d '{"workload": "test", "trace_id": "t1", "execution_id": "e1"}' | jq .
```

### Expected HTTP Code
`401`

### Expected Response
```json
{
  "error": "Unauthorized: Invalid token"
}
```

### Expected Logs (Bridge)
```json
{"timestamp":"...","trace_id":null,"execution_id":null,"service_name":"bridge","status":"error","message":"Token validation failed: invalid token"}
```

### Verification
- No execution occurs
- Token rejected before reaching Execution Service
- Bridge returns 401 immediately

---

## Test 3: Tampered Token → BLOCK

### Setup
```bash
# Get valid token
TOKEN=$(curl -s -X POST http://localhost:3001/token \
  -H "Content-Type: application/json" \
  -d '{"trace_id": "t1", "execution_id": "e1"}' | jq -r '.token')

# Tamper with token (modify payload section)
# JWT format: header.payload.signature
TAMPERED_TOKEN=$(echo $TOKEN | awk -F'.' '{$2="dGFtcGVyZWQ="; print $1"."$2"."$3}')
```

### Exact Command
```bash
curl -s -X POST http://localhost:3002/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TAMPERED_TOKEN" \
  -d '{"workload": "test", "trace_id": "t1", "execution_id": "e1"}' | jq .
```

### Expected HTTP Code
`401`

### Expected Response
```json
{
  "error": "Unauthorized: Invalid token"
}
```

### Expected Logs (Bridge)
```json
{"timestamp":"...","trace_id":null,"execution_id":null,"service_name":"bridge","status":"error","message":"Token validation failed: invalid signature"}
```

### Verification
- Signature verification fails
- Token rejected
- No execution occurs

---

## Test 4: Replay Token → BLOCK

### Setup
```bash
# Get valid token with jti claim
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:3001/token \
  -H "Content-Type: application/json" \
  -d '{"trace_id": "replay-trace", "execution_id": "replay-exec"}')
TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.token')
```

### Exact Command (First Use - Should Succeed)
```bash
curl -s -X POST http://localhost:3002/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"workload": "test", "trace_id": "replay-trace", "execution_id": "replay-exec"}' | jq .
```

### Expected HTTP Code (First Use)
`200` (success)

### Exact Command (Replay - Should Fail)
```bash
curl -s -X POST http://localhost:3002/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"workload": "test", "trace_id": "replay-trace", "execution_id": "replay-exec"}' | jq .
```

### Expected HTTP Code (Replay)
`401`

### Expected Response (Replay)
```json
{
  "error": "Unauthorized: Token replay detected"
}
```

### Expected Logs (Bridge)
```json
{"timestamp":"...","trace_id":"replay-trace","execution_id":"replay-exec","service_name":"bridge","status":"error","message":"Replay attack detected - jti: ..."}
```

### Verification
- jti claim tracked in Bridge's replayCache
- Second use of same token blocked
- "Replay attack detected" logged

---

## Test 5: Execution Down → FAIL

### Setup
```bash
# Stop Execution service
docker-compose stop execution
# OR
lsof -ti:3003 | xargs kill -9
```

### Exact Command
```bash
# First get a valid token
TOKEN=$(curl -s -X POST http://localhost:3001/token \
  -H "Content-Type: application/json" \
  -d '{"trace_id": "exec-test", "execution_id": "exec-1"}' | jq -r '.token')

curl -s -X POST http://localhost:3002/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"workload": "test", "trace_id": "exec-test", "execution_id": "exec-1"}' | jq .
```

### Expected HTTP Code
`503`

### Expected Response
```json
{
  "error": "Execution service unavailable - system stopped",
  "trace_id": "exec-test",
  "execution_id": "exec-1"
}
```

### Expected Logs (Bridge)
```json
{"timestamp":"...","trace_id":"exec-test","execution_id":"exec-1","service_name":"bridge","status":"error","message":"Execution failed: connect ECONNREFUSED..."}
```

### Verification
- No fallback execution in Bridge
- System stops immediately
- No degraded mode

### Teardown
```bash
docker-compose start execution
```

---

## Test 6: Bucket Failure → FAIL

### Setup
```bash
# Stop Bucket service
docker-compose stop bucket
# OR
lsof -ti:3004 | xargs kill -9
```

### Exact Command
```bash
# Initiate full workflow (will fail at Execution → Bucket step)
curl -s -X POST http://localhost:3000/initiate \
  -H "Content-Type: application/json" \
  -d '{"workload": "bucket-test"}' | jq .
```

### Expected HTTP Code
`503` or `500`

### Expected Response
```json
{
  "error": "Execution failed - system stopped",
  "trace_id": "...",
  "execution_id": "..."
}
```

### Expected Logs (Execution)
```json
{"timestamp":"...","trace_id":"...","execution_id":"...","service_name":"execution","status":"error","message":"Execution failed: connect ECONNREFUSED..."}
```

### Verification
- Execution Service cannot store artifact
- No local storage fallback
- System stops immediately

### Teardown
```bash
docker-compose start bucket
```

---

## Summary Table

| Test | Failure | Expected Code | Expected Behavior |
|------|---------|---------------|-------------------|
| 1 | Sarathi down | 503 | BLOCK - no progression |
| 2 | Invalid token | 401 | BLOCK - unauthorized |
| 3 | Tampered token | 401 | BLOCK - signature invalid |
| 4 | Replay token | 401 | BLOCK - replay detected |
| 5 | Execution down | 503 | FAIL - no fallback |
| 6 | Bucket failure | 503 | FAIL - no local storage |

---

## Proof Artifacts

Run all tests and capture output:
```bash
# Create proof directory
mkdir -p proof_artifacts

# Run each test and save output
curl -s ... > proof_artifacts/test1_sarathi_down.json
curl -s ... > proof_artifacts/test2_invalid_token.json
...

# Save logs
docker-compose logs --tail=100 > proof_artifacts/all_logs.txt
```

Reviewers can examine these artifacts to verify correct failure behavior.
