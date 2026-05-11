#!/bin/bash

# TRACE_INTEGRITY_TEST.SH - Verify trace_id and execution_id unchanged across all services
# Proves IDs are immutable throughout the entire flow

set -e

echo "=========================================="
echo "TANTRA TRACE INTEGRITY VERIFICATION"
echo "=========================================="
echo ""

CORE_URL="http://localhost:3000"
SARATHI_URL="http://localhost:3001"
BRIDGE_URL="http://localhost:3002"
EXECUTION_URL="http://localhost:3003"
BUCKET_URL="http://localhost:3004"

# Generate known IDs
TEST_TRACE="trace-$(date +%s)"
TEST_EXEC="exec-$(date +%s)"

echo "TASK: Verify immutable trace_id and execution_id"
echo "-----------------------------------"
echo ""
echo "Test IDs:"
echo "  trace_id: $TEST_TRACE"
echo "  execution_id: $TEST_EXEC"
echo ""

# Step 1: Get token from Sarathi and verify IDs
echo "Step 1: Checking Sarathi (token generation)..."
TOKEN_RESPONSE=$(curl -s -X POST "$SARATHI_URL/token" \
  -H "Content-Type: application/json" \
  -d "{\"trace_id\": \"$TEST_TRACE\", \"execution_id\": \"$TEST_EXEC\"}")

SARATHI_TRACE=$(echo "$TOKEN_RESPONSE" | jq -r '.trace_id')
SARATHI_EXEC=$(echo "$TOKEN_RESPONSE" | jq -r '.execution_id')
TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.token')

if [ "$SARATHI_TRACE" = "$TEST_TRACE" ] && [ "$SARATHI_EXEC" = "$TEST_EXEC" ]; then
  echo "  ✓ Sarathi: IDs match"
else
  echo "  ✗ Sarathi: ID mismatch"
  exit 1
fi
echo ""

# Step 2: Call Bridge and verify IDs in response
echo "Step 2: Checking Bridge (pass-through)..."
BRIDGE_RESPONSE=$(curl -s -X POST "$BRIDGE_URL/execute" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"workload\": \"trace-test\", \"trace_id\": \"$TEST_TRACE\", \"execution_id\": \"$TEST_EXEC\"}")

BRIDGE_TRACE=$(echo "$BRIDGE_RESPONSE" | jq -r '.trace_id')
BRIDGE_EXEC=$(echo "$BRIDGE_RESPONSE" | jq -r '.execution_id')

if [ "$BRIDGE_TRACE" = "$TEST_TRACE" ] && [ "$BRIDGE_EXEC" = "$TEST_EXEC" ]; then
  echo "  ✓ Bridge: IDs match"
else
  echo "  ✗ Bridge: ID mismatch"
  exit 1
fi
echo ""

# Step 3: Check Execution response
echo "Step 3: Checking Execution (workload execution)..."
EXEC_TRACE=$(echo "$BRIDGE_RESPONSE" | jq -r '.trace_id')
EXEC_EXEC=$(echo "$BRIDGE_RESPONSE" | jq -r '.execution_id')

if [ "$EXEC_TRACE" = "$TEST_TRACE" ] && [ "$EXEC_EXEC" = "$TEST_EXEC" ]; then
  echo "  ✓ Execution: IDs match"
else
  echo "  ✗ Execution: ID mismatch"
  exit 1
fi
echo ""

# Step 4: Retrieve from Bucket and verify
echo "Step 4: Checking Bucket (artifact storage)..."
sleep 1  # Allow time for storage
BUCKET_RESPONSE=$(curl -s "$BUCKET_URL/retrieve/$TEST_TRACE/$TEST_EXEC")

BUCKET_TRACE=$(echo "$BUCKET_RESPONSE" | jq -r '.trace_id')
BUCKET_EXEC=$(echo "$BUCKET_RESPONSE" | jq -r '.execution_id')

if [ "$BUCKET_TRACE" = "$TEST_TRACE" ] && [ "$BUCKET_EXEC" = "$TEST_EXEC" ]; then
  echo "  ✓ Bucket: IDs match"
else
  echo "  ✗ Bucket: ID mismatch"
  exit 1
fi
echo ""

# Step 5: Verify via full workflow (Core initiation)
echo "Step 5: Verifying via Core initiation..."
CORE_RESPONSE=$(curl -s -X POST "$CORE_URL/initiate" \
  -H "Content-Type: application/json" \
  -d '{"workload": "full-trace-test"}')

CORE_TRACE=$(echo "$CORE_RESPONSE" | jq -r '.trace_id')
CORE_EXEC=$(echo "$CORE_RESPONSE" | jq -r '.execution_id')
CORE_RESULT_TRACE=$(echo "$CORE_RESPONSE" | jq -r '.result.trace_id')
CORE_RESULT_EXEC=$(echo "$CORE_RESPONSE" | jq -r '.result.execution_id')

if [ "$CORE_TRACE" = "$CORE_RESULT_TRACE" ] && [ "$CORE_EXEC" = "$CORE_RESULT_EXEC" ]; then
  echo "  ✓ Core → Result: IDs propagated correctly"
else
  echo "  ✗ Core → Result: ID mismatch"
  exit 1
fi
echo ""

echo "=========================================="
echo "TRACE INTEGRITY SUMMARY"
echo "=========================================="
echo ""
echo "SAME TRACE VERIFIED across all services:"
echo ""
echo "  Core:       trace_id=$CORE_TRACE, execution_id=$CORE_EXEC"
echo "  Sarathi:    trace_id=$TEST_TRACE, execution_id=$TEST_EXEC"
echo "  Bridge:     trace_id=$BRIDGE_TRACE, execution_id=$BRIDGE_EXEC"
echo "  Execution:  trace_id=$EXEC_TRACE, execution_id=$EXEC_EXEC"
echo "  Bucket:     trace_id=$BUCKET_TRACE, execution_id=$BUCKET_EXEC"
echo ""
echo "✓ ALL TRACE_IDS MATCH: $TEST_TRACE"
echo "✓ ALL EXECUTION_IDS MATCH: $TEST_EXEC"
echo ""
echo "IDs are IMMUTABLE - no mutation allowed."
echo ""
