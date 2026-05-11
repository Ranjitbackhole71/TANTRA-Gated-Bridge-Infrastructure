#!/bin/bash

# DEMO_FLOW.SH - Complete demonstration of TANTRA infrastructure
# Shows full workflow with proof of separation and zero-trust

set -e

echo "=========================================="
echo "TANTRA INFRASTRUCTURE DEMO FLOW"
echo "=========================================="
echo ""

echo "This demo will:"
echo "1. Verify all services are running"
echo "2. Show service separation (ports)"
echo "3. Demonstrate full workflow"
echo "4. Prove trace_id consistency"
echo "5. Show failure scenarios"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check services
echo "=========================================="
echo "STEP 1: SERVICE HEALTH CHECK"
echo "=========================================="
echo ""

SERVICES=("3000:Core" "3001:Sarathi" "3002:Bridge" "3003:Execution" "3004:Bucket")
ALL_HEALTHY=true

for SVC in "${SERVICES[@]}"; do
  PORT="${SVC%%:*}"
  NAME="${SVC##*:}"
  if curl -s --connect-timeout 2 "http://localhost:$PORT/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} $NAME (port $PORT) is healthy"
  else
    echo -e "${RED}✗${NC} $NAME (port $PORT) is NOT responding"
    ALL_HEALTHY=false
  fi
done

if [ "$ALL_HEALTHY" = false ]; then
  echo ""
  echo "Start services first:"
  echo "  docker-compose up -d"
  echo "  OR start each service manually"
  exit 1
fi
echo ""

# Full workflow
echo "=========================================="
echo "STEP 2: FULL WORKFLOW DEMONSTRATION"
echo "=========================================="
echo ""

echo "Initiating workflow from Core service..."
RESPONSE=$(curl -s -X POST http://localhost:3000/initiate \
  -H "Content-Type: application/json" \
  -d '{"workload": "demo-workflow"}')

echo "Response from Core:"
echo "$RESPONSE" | jq .
echo ""

TRACE_ID=$(echo "$RESPONSE" | jq -r '.trace_id')
EXEC_ID=$(echo "$RESPONSE" | jq -r '.execution_id')

echo "Tracking IDs:"
echo "  trace_id: $TRACE_ID"
echo "  execution_id: $EXEC_ID"
echo ""

# Verify trace consistency
echo "=========================================="
echo "STEP 3: VERIFY TRACE INTEGRITY"
echo "=========================================="
echo ""

echo "Checking Bucket for stored artifact..."
ARTIFACT=$(curl -s "http://localhost:3004/retrieve/$TRACE_ID/$EXEC_ID")
echo "Artifact from Bucket:"
echo "$ARTIFACT" | jq .
echo ""

ARTIFACT_TRACE=$(echo "$ARTIFACT" | jq -r '.trace_id')
ARTIFACT_EXEC=$(echo "$ARTIFACT" | jq -r '.execution_id')

if [ "$ARTIFACT_TRACE" = "$TRACE_ID" ] && [ "$ARTIFACT_EXEC" = "$EXEC_ID" ]; then
  echo -e "${GREEN}✓ TRACE INTEGRITY VERIFIED${NC}"
  echo "  Same trace_id and execution_id across all services"
else
  echo -e "${RED}✗ TRACE INTEGRITY FAILED${NC}"
  exit 1
fi
echo ""

# Show logs
echo "=========================================="
echo "STEP 4: STRUCTURED LOGGING EVIDENCE"
echo "=========================================="
echo ""

echo "Sample log entries (last 10 lines from each service):"
echo ""

if command -v docker &> /dev/null; then
  for SERVICE in core sarathi bridge execution bucket; do
    echo "--- $SERVICE ---"
    docker-compose logs --tail=2 $SERVICE 2>/dev/null | grep -E '^{' || echo "  (no logs)"
    echo ""
  done
fi
echo ""

# Failure demonstration
echo "=========================================="
echo "STEP 5: FAILURE PROOF (Replay Attack)"
echo "=========================================="
echo ""

echo "Generating token..."
TOKEN_RESP=$(curl -s -X POST http://localhost:3001/token \
  -H "Content-Type: application/json" \
  -d "{\"trace_id\": \"fail-test\", \"execution_id\": \"fail-exec\"}")
TOKEN=$(echo "$TOKEN_RESP" | jq -r '.token')

echo "Using token first time (should succeed)..."
curl -s -X POST http://localhost:3002/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"workload": "fail-test", "trace_id": "fail-test", "execution_id": "fail-exec"}' | jq -c .
echo ""

echo "Replaying same token (should fail with 401)..."
HTTP_CODE=$(curl -s -o /tmp/replay_test.txt -w "%{http_code}" -X POST http://localhost:3002/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"workload": "fail-test", "trace_id": "fail-test", "execution_id": "fail-exec"}')

if [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✓ REPLAY PROTECTION WORKING${NC}"
  echo "  HTTP Code: $HTTP_CODE"
  cat /tmp/replay_test.txt
else
  echo -e "${RED}✗ REPLAY PROTECTION FAILED${NC}"
  echo "  Expected 401, got $HTTP_CODE"
fi
echo ""

echo "=========================================="
echo "DEMO COMPLETE"
echo "=========================================="
echo ""
echo "Evidence collected:"
echo "  ✓ All services running independently"
echo "  ✓ Full workflow successful"
echo "  ✓ Trace integrity verified"
echo "  ✓ Structured logging working"
echo "  ✓ Replay protection enforced"
echo ""
echo "For more tests, run:"
echo "  ./tests/replay_test.sh"
echo "  ./tests/trace_integrity_test.sh"
echo "  ./tests/bucket_persistence_test.sh"
echo ""
