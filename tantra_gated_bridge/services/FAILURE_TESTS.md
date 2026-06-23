# TANTRA Failure Tests

## Objective
Verify system stops immediately when dependencies fail - NO degraded mode, NO fallbacks.

## Prerequisites
```bash
docker-compose up -d
```

---

## Test 1: Sarathi Down → BLOCK

**Setup:**
```bash
docker-compose stop sarathi
```

**Test:**
```bash
curl -X POST http://localhost:3000/initiate \
  -H "Content-Type: application/json" \
  -d '{"workload": "test-task"}'
```

**Expected Result:**
- Core service returns error
- System BLOCKS immediately
- No fallback token generation
- No degraded mode

**Teardown:**
```bash
docker-compose start sarathi
```

---

## Test 2: Invalid Token → BLOCK

**Setup:**
```bash
TOKEN="invalid.jwt.token"
```

**Test:**
```bash
curl -X POST http://localhost:3002/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"workload": "test", "trace_id": "t1", "execution_id": "e1"}'
```

**Expected Result:**
- Bridge returns 401 Unauthorized
- No execution occurs
- Token rejected

---

## Test 3: Tampered Token → BLOCK

**Setup:**
```bash
# Get valid token
VALID_TOKEN=$(curl -s -X POST http://localhost:3001/token \
  -H "Content-Type: application/json" \
  -d '{"trace_id": "t1", "execution_id": "e1"}' | jq -r '.token')

# Tamper with token (modify payload)
TAMPERED_TOKEN=$(echo $VALID_TOKEN | sed 's/\./X./')
```

**Test:**
```bash
curl -X POST http://localhost:3002/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TAMPERED_TOKEN" \
  -d '{"workload": "test", "trace_id": "t1", "execution_id": "e1"}'
```

**Expected Result:**
- Bridge returns 401 Unauthorized
- Signature verification fails
- Token rejected

---

## Test 4: Replay Token → BLOCK

**Note:** JWT expiry prevents replay. Wait for token expiry or use expired token.

**Setup:**
```bash
# Create an expired token manually (for testing)
# In production, use short expiry times
```

**Expected Result:**
- Expired token rejected
- No replay allowed

---

## Test 5: Execution Service Down → FAIL

**Setup:**
```bash
docker-compose stop execution
```

**Test:**
```bash
# Get valid token
TOKEN=$(curl -s -X POST http://localhost:3001/token \
  -H "Content-Type: application/json" \
  -d '{"trace_id": "t1", "execution_id": "e1"}' | jq -r '.token')

curl -X POST http://localhost:3002/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"workload": "test", "trace_id": "t1", "execution_id": "e1"}'
```

**Expected Result:**
- Bridge returns 503 Service Unavailable
- No fallback execution
- System FAILS immediately

**Teardown:**
```bash
docker-compose start execution
```

---

## Test 6: Bucket Failure → FAIL

**Setup:**
```bash
docker-compose stop bucket
```

**Test:**
```bash
# Initiate full workflow
curl -X POST http://localhost:3000/initiate \
  -H "Content-Type: application/json" \
  -d '{"workload": "test-task"}'
```

**Expected Result:**
- Execution service fails to store artifact
- Returns error immediately
- No local storage fallback
- System FAILS

**Teardown:**
```bash
docker-compose start bucket
```

---

## Test 7: ID Mutation → BLOCK

**Setup:**
```bash
TOKEN=$(curl -s -X POST http://localhost:3001/token \
  -H "Content-Type: application/json" \
  -d '{"trace_id": "t1", "execution_id": "e1"}' | jq -r '.token')
```

**Test:**
```bash
curl -X POST http://localhost:3002/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"workload": "test", "trace_id": "DIFFERENT-TRACE", "execution_id": "e1"}'
```

**Expected Result:**
- Bridge detects trace_id mutation
- Returns 400 Bad Request
- ID mutation forbidden

---

## Summary

| Test | Failure | Expected Behavior |
|------|---------|-------------------|
| 1 | Sarathi down | BLOCK - no token, no progression |
| 2 | Invalid token | BLOCK - 401 Unauthorized |
| 3 | Tampered token | BLOCK - 401 signature invalid |
| 4 | Replay token | BLOCK - 401 expired/invalid |
| 5 | Execution down | FAIL - 503 no fallback |
| 6 | Bucket down | FAIL - storage error |
| 7 | ID mutation | BLOCK - 400 mutation forbidden |

## Verification Commands

After each test, verify logs:
```bash
docker-compose logs --tail=50
```

Check for proper error messages and no fallback behavior.
