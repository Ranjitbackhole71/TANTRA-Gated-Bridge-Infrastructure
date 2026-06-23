#!/bin/bash
# TANTRA VERIFY — Single command to verify system health
# Usage: bash scripts/verify.sh

set -e

echo "========================================"
echo "  TANTRA Infrastructure — VERIFY"
echo "========================================"
echo ""

# 1. Health endpoints
echo "1. Health Endpoints"
echo "------------------"
for port in 3000 3001 3002 3003 3004; do
  result=$(curl -s --connect-timeout 2 http://localhost:$port/health 2>/dev/null || echo "DOWN")
  status="✅"
  if [[ "$result" == "DOWN" ]]; then
    status="❌"
  fi
  echo "  $status Port $port: $result"
done

echo ""
echo "2. E2E Workflow"
echo "---------------"
response=$(curl -s -X POST http://localhost:3000/initiate \
  -H "Content-Type: application/json" \
  -d '{"workload": "verify-test"}' 2>/dev/null || echo '{"status":"FAILED"}')
trace_id=$(echo "$response" | grep -o '"trace_id":"[^"]*"' | head -1 | cut -d'"' -f4)
execution_id=$(echo "$response" | grep -o '"execution_id":"[^"]*"' | head -1 | cut -d'"' -f4)
status=$(echo "$response" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ "$status" == "completed" ]]; then
  echo "  ✅ Workflow: $status"
  echo "  Trace ID: $trace_id"
  echo "  Execution ID: $execution_id"
else
  echo "  ❌ Workflow: $status"
  echo "  Response: $response"
fi

echo ""
echo "3. Bucket Persistence"
echo "---------------------"
if [[ -n "$trace_id" && -n "$execution_id" ]]; then
  artifact=$(curl -s http://localhost:3004/retrieve/$trace_id/$execution_id 2>/dev/null)
  bucket_trace=$(echo "$artifact" | grep -o '"trace_id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [[ "$bucket_trace" == "$trace_id" ]]; then
    echo "  ✅ Artifact stored and verified"
  else
    echo "  ❌ Artifact verification failed"
  fi
fi

echo ""
echo "4. Replay Protection"
echo "--------------------"
token_response=$(curl -s -X POST http://localhost:3001/token \
  -H "Content-Type: application/json" \
  -d '{"trace_id":"verify-replay","execution_id":"verify-replay-e"}')
token=$(echo "$token_response" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ -n "$token" ]]; then
  # First use
  first=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3002/execute \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $token" \
    -d '{"workload":"verify","trace_id":"verify-replay","execution_id":"verify-replay-e"}')
  
  # Replay
  replay=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3002/execute \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $token" \
    -d '{"workload":"verify","trace_id":"verify-replay","execution_id":"verify-replay-e"}')
  
  echo "  First use: HTTP $first $([ "$first" == "200" ] && echo "✅" || echo "❌")"
  echo "  Replay:    HTTP $replay $([ "$replay" == "401" ] && echo "✅" || echo "❌")"
else
  echo "  ❌ Could not generate token"
fi

echo ""
echo "========================================"
echo "  VERIFICATION COMPLETE"
echo "========================================"
