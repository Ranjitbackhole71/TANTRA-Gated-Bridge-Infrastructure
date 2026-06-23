#!/bin/bash
# Integration Verification — Validates all integration points
# Usage: bash scripts/integration_verify.sh

set -e

PASS=0
FAIL=0

check() {
  local name="$1"
  local result="$2"
  if [ "$result" = "0" ]; then
    echo "  ✅ $name"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $name"
    FAIL=$((FAIL + 1))
  fi
}

echo "========================================"
echo "  INTEGRATION VERIFICATION"
echo "========================================"
echo ""

# 1. Service health
echo "1. Service Integration"
echo "---------------------"
for port in 3000 3001 3002 3003 3004; do
  curl -s --connect-timeout 2 "http://localhost:$port/health" > /dev/null 2>&1 && check "Port $port health" 0 || check "Port $port health" 1
done

# 2. Core → Sarathi integration
echo ""
echo "2. Core → Sarathi"
echo "-----------------"
CORE_HEALTH=$(curl -s --connect-timeout 2 http://localhost:3000/health 2>/dev/null | grep -c '"healthy"')
check "Core service accessible" $([ "$CORE_HEALTH" -ge 1 ] && echo 0 || echo 1)

SARATHI_TOKEN=$(curl -s -X POST http://localhost:3001/token \
  -H "Content-Type: application/json" \
  -d '{"trace_id":"int-test","execution_id":"int-e"}' 2>/dev/null | grep -c '"token"')
check "Sarathi issues tokens" $([ "$SARATHI_TOKEN" -ge 1 ] && echo 0 || echo 1)

# 3. Sarathi → Bridge integration
echo ""
echo "3. Sarathi → Bridge"
echo "-------------------"
PUBKEY=$(curl -s http://localhost:3001/public-key 2>/dev/null | grep -c '"public_key"')
check "Public key endpoint" $([ "$PUBKEY" -ge 1 ] && echo 0 || echo 1)

# 4. Bridge → Execution integration
echo ""
echo "4. Bridge → Execution"
echo "---------------------"
TOKEN=$(curl -s -X POST http://localhost:3001/token \
  -H "Content-Type: application/json" \
  -d '{"trace_id":"bridge-exec","execution_id":"bridge-exec-e"}' 2>/dev/null | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  BRIDGE_EXEC=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3002/execute \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"workload":"int-test","trace_id":"bridge-exec","execution_id":"bridge-exec-e"}' 2>/dev/null)
  check "Bridge forwards to Execution (HTTP $BRIDGE_EXEC)" $([ "$BRIDGE_EXEC" = "200" ] && echo 0 || echo 1)
else
  check "Bridge forwards to Execution" 1
fi

# 5. Execution → Bucket integration
echo ""
echo "5. Execution → Bucket"
echo "---------------------"
BUCKET_STORE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3004/store \
  -H "Content-Type: application/json" \
  -d "{\"trace_id\":\"bucket-test\",\"execution_id\":\"bucket-e\",\"result\":{\"test\":true},\"timestamp\":\"$(date -Iseconds)\",\"duration_ms\":100}" 2>/dev/null)
check "Bucket accepts artifacts (HTTP $BUCKET_STORE)" $([ "$BUCKET_STORE" = "201" ] && echo 0 || echo 1)

# 6. Full E2E flow
echo ""
echo "6. End-to-End Flow"
echo "------------------"
E2E=$(curl -s -X POST http://localhost:3000/initiate \
  -H "Content-Type: application/json" \
  -d '{"workload":"int-e2e"}' 2>/dev/null | grep -c '"completed"')
check "Full E2E workflow succeeds" $([ "$E2E" -ge 1 ] && echo 0 || echo 1)

# 7. Replay integration
echo ""
echo "7. Replay Layer"
echo "--------------"
if [ -f "services/replay_persistence/data/replay_log.jsonl" ]; then
  RECORDS=$(wc -l < "services/replay_persistence/data/replay_log.jsonl" 2>/dev/null || echo 0)
  check "Replay log exists ($RECORDS records)" 0
else
  check "Replay log exists" 1
fi

echo ""
echo "========================================"
echo "  INTEGRATION VERIFICATION RESULTS"
echo "========================================"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "  Total:  $((PASS + FAIL))"
echo "========================================"

exit $FAIL
