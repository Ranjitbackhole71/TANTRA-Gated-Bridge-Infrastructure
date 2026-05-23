#!/bin/bash
set -e

echo "=========================================="
echo " TANTRA Gated Bridge - Full Stack Verify"
echo "=========================================="
echo ""

EXIT_CODE=0

# Phase 1: Health checks
echo "[1/5] Service health checks..."
for svc in core sarathi bridge execution bucket; do
    case $svc in
        core) port=3000 ;;
        sarathi) port=3001 ;;
        bridge) port=3002 ;;
        execution) port=3003 ;;
        bucket) port=3004 ;;
    esac
    status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/health 2>/dev/null || echo "000")
    if [ "$status" = "200" ]; then
        echo "  [$svc] HEALTHY"
    else
        echo "  [$svc] UNHEALTHY (HTTP $status)"
        EXIT_CODE=1
    fi
done
[ $EXIT_CODE -eq 0 ] && echo "  PASS: All services healthy" || echo "  FAIL: Not all services healthy"

# Phase 2: End-to-end execution
echo "[2/5] End-to-end execution test..."
RESPONSE=$(curl -s -X POST http://localhost:3000/initiate \
  -H "Content-Type: application/json" \
  -d '{"workload":"verify-test"}' \
  --max-time 15)
if echo "$RESPONSE" | grep -q '"completed"'; then
    TRACE_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('trace_id','unknown'))" 2>/dev/null || echo "unknown")
    echo "  PASS: Execution completed (trace: $TRACE_ID)"
else
    echo "  FAIL: Execution failed"
    echo "  Response: $RESPONSE"
    EXIT_CODE=1
fi

# Phase 3: Replay persistence check
echo "[3/5] Replay persistence check..."
RECORDS=$(node -e "
const store = require('./services/replay_persistence/append_only_store');
console.log(store.getChainState().record_count);
" 2>/dev/null || echo "skip")
if [ "$RECORDS" != "skip" ]; then
    echo "  PASS: Replay log has $RECORDS records"
else
    echo "  SKIP: Replay persistence check (requires node)"
fi

# Phase 4: Chain integrity
echo "[4/5] Chain integrity check..."
INTEGRITY=$(node -e "
const store = require('./services/replay_persistence/append_only_store');
const r = store.validateChainIntegrity();
console.log(JSON.stringify({valid: r.valid, count: r.record_count}));
" 2>/dev/null || echo '{"valid":false,"count":0}')
if echo "$INTEGRITY" | grep -q '"valid":true'; then
    COUNT=$(echo "$INTEGRITY" | python3 -c "import sys,json; print(json.load(sys.stdin)['count'])" 2>/dev/null || echo "?")
    echo "  PASS: Chain integrity valid ($COUNT records)"
else
    echo "  FAIL: Chain integrity broken"
    EXIT_CODE=1
fi

# Phase 5: Summary
echo "[5/5] Verification complete"
echo ""
echo "=========================================="
if [ $EXIT_CODE -eq 0 ]; then
    echo " RESULT: FULL STACK VERIFIED - PASS"
else
    echo " RESULT: FULL STACK VERIFIED - FAIL"
fi
echo "=========================================="

exit $EXIT_CODE
