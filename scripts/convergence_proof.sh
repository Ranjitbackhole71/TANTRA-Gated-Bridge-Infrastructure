#!/bin/bash
# TANTRA FULL CONVERGENCE PROOF — Single command for complete system validation
# Usage: bash scripts/convergence_proof.sh

set -e

PROOF_DIR="proof/convergence_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$PROOF_DIR"

echo "============================================"
echo "  TANTRA FULL CONVERGENCE PROOF"
echo "============================================"
echo "  Timestamp: $(date -Iseconds)"
echo "  Proof dir: $PROOF_DIR"
echo "============================================"
echo ""

# === SECTION 1: Service Health ===
echo "1. SERVICE HEALTH"
echo "------------------"
for port in 3000 3001 3002 3003 3004; do
  result=$(curl -s --connect-timeout 2 http://localhost:$port/health 2>/dev/null || echo '{"service":"DOWN","status":"unreachable"}')
  echo "$result" > "$PROOF_DIR/health_$port.json"
  echo "$result" | grep -q '"healthy"' && echo "  ✅ Port $port" || echo "  ❌ Port $port"
done

# === SECTION 2: E2E Workflow ===
echo ""
echo "2. END-TO-END WORKFLOW"
echo "----------------------"
RESPONSE=$(curl -s -X POST http://localhost:3000/initiate \
  -H "Content-Type: application/json" \
  -d '{"workload": "convergence-proof"}')
echo "$RESPONSE" > "$PROOF_DIR/e2e_workflow.json"
TRACE_ID=$(echo "$RESPONSE" | grep -o '"trace_id":"[^"]*"' | head -1 | cut -d'"' -f4)
EXEC_ID=$(echo "$RESPONSE" | grep -o '"execution_id":"[^"]*"' | head -1 | cut -d'"' -f4)
STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ "$STATUS" == "completed" ]]; then
  echo "  ✅ Workflow: $STATUS"
  echo "  Trace ID: $TRACE_ID"
else
  echo "  ❌ Workflow: $STATUS"
fi

# === SECTION 3: Trace Integrity ===
echo ""
echo "3. TRACE INTEGRITY"
echo "------------------"
if [[ -n "$TRACE_ID" && -n "$EXEC_ID" ]]; then
  ARTIFACT=$(curl -s "http://localhost:3004/retrieve/$TRACE_ID/$EXEC_ID")
  echo "$ARTIFACT" > "$PROOF_DIR/artifact.json"
  BUCKET_TRACE=$(echo "$ARTIFACT" | grep -o '"trace_id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [[ "$BUCKET_TRACE" == "$TRACE_ID" ]]; then
    echo "  ✅ Trace immutable across services"
    echo "  Hash: $(echo "$ARTIFACT" | grep -o '"hash":"[^"]*"' | head -1 | cut -d'"' -f4)"
  else
    echo "  ❌ Trace mutation detected!"
  fi
fi

# === SECTION 4: Replay Protection ===
echo ""
echo "4. REPLAY PROTECTION"
echo "--------------------"
TOKEN_RESP=$(curl -s -X POST http://localhost:3001/token \
  -H "Content-Type: application/json" \
  -d '{"trace_id":"proof-replay","execution_id":"proof-replay-e"}')
TOKEN=$(echo "$TOKEN_RESP" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "$TOKEN_RESP" > "$PROOF_DIR/token_response.json"

if [[ -n "$TOKEN" ]]; then
  # First use
  FIRST_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3002/execute \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"workload":"proof","trace_id":"proof-replay","execution_id":"proof-replay-e"}')
  
  # Replay
  REPLAY_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3002/execute \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"workload":"proof","trace_id":"proof-replay","execution_id":"proof-replay-e"}')
  
  echo "  First use: HTTP $FIRST_CODE $([ "$FIRST_CODE" == "200" ] && echo "✅" || echo "❌")"
  echo "  Replay:    HTTP $REPLAY_CODE $([ "$REPLAY_CODE" == "401" ] && echo "✅" || echo "❌")"
  echo "$FIRST_CODE" > "$PROOF_DIR/replay_first.txt"
  echo "$REPLAY_CODE" > "$PROOF_DIR/replay_second.txt"
else
  echo "  ❌ Token generation failed"
fi

# === SECTION 5: Failure Propagation ===
echo ""
echo "5. FAILURE PROPAGATION"
echo "----------------------"
# Invalid token
INVALID_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3002/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid.token.here" \
  -d '{"workload":"proof","trace_id":"t1","execution_id":"e1"}')
echo "$INVALID_CODE" > "$PROOF_DIR/failure_invalid_token.txt"
echo "  Invalid token: HTTP $INVALID_CODE $([ "$INVALID_CODE" == "401" ] && echo "✅" || echo "❌")"

# ID mutation
MUTATION_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3002/execute \
  -H "Content-Type: application/json" \
  -d '{"workload":"proof","trace_id":"FAKE","execution_id":"e1"}')
echo "$MUTATION_CODE" > "$PROOF_DIR/failure_id_mutation.txt"
echo "  ID mutation:  HTTP $MUTATION_CODE $([ "$MUTATION_CODE" == "401" ] && echo "✅" || echo "❌")"

# === SECTION 6: Replay Persistence ===
echo ""
echo "6. REPLAY PERSISTENCE"
echo "---------------------"
if [ -f "services/replay_persistence/data/replay_log.jsonl" ]; then
  RECORD_COUNT=$(wc -l < "services/replay_persistence/data/replay_log.jsonl")
  echo "  Replay log records: $RECORD_COUNT"
  cp "services/replay_persistence/data/replay_log.jsonl" "$PROOF_DIR/replay_log.jsonl"
  cp "services/replay_persistence/data/replay_chain.json" "$PROOF_DIR/replay_chain.json"
  echo "  ✅ Replay persistence files copied"
else
  echo "  ⚠️ No replay log found"
fi

# === SECTION 7: Survivability Tests ===
echo ""
echo "7. SURVIVABILITY TESTS"
echo "----------------------"
cd services/survivability_tests
node test_suite.js --proof 2>&1 | tee "../../$PROOF_DIR/survivability_output.txt" || true
cd ../..

# Chain integrity
echo ""
echo "8. CHAIN INTEGRITY"
echo "------------------"
node -e "
const store = require('./services/replay_persistence/append_only_store');
const r = store.validateChainIntegrity();
console.log('  Chain valid: ' + (r.valid ? '✅' : '❌') + ' (' + r.record_count + ' records)');
require('fs').writeFileSync('$PROOF_DIR/chain_integrity.json', JSON.stringify(r, null, 2));
"

# === SECTION 9: Key Durability ===
echo ""
echo "9. KEY DURABILITY"
echo "-----------------"
if [ -f "services/sarathi/keys/key_meta.json" ]; then
  cat "services/sarathi/keys/key_meta.json" > "$PROOF_DIR/key_meta.json"
  echo "  ✅ Keys persisted: $(cat services/sarathi/keys/key_meta.json | grep -o '"key_id":"[^"]*"' | cut -d'"' -f4)"
else
  echo "  ⚠️ No key persistence file (running in env-var mode)"
fi

# === SECTION 10: Deployment Info ===
echo ""
echo "10. DEPLOYMENT INFO"
echo "-------------------"
echo "  Platform: $(uname -s 2>/dev/null || echo 'Windows')"
echo "  Node: $(node -v 2>/dev/null || echo 'N/A')"
echo "  Docker: $(docker --version 2>/dev/null || echo 'N/A')"
echo ""

# === FINAL SUMMARY ===
echo "============================================"
echo "  CONVERGENCE PROOF SUMMARY"
echo "============================================"
echo "  Proof directory: $PROOF_DIR"
echo "  Files:"
ls -la "$PROOF_DIR/" | grep -v '^total' | grep -v '^d' | awk '{print "    " $NF}'
echo "============================================"
echo "  Reviewers: Examine $PROOF_DIR for evidence."
echo "============================================"
