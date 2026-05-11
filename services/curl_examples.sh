#!/bin/bash

# TANTRA Infrastructure - Curl Examples
# Run services first: docker-compose up

BASE_URL="http://localhost"

echo "=== TANTRA Infrastructure Curl Examples ==="
echo ""

# Health checks
echo "1. Health Check - All Services"
curl -s "$BASE_URL:3000/health" | jq .
curl -s "$BASE_URL:3001/health" | jq .
curl -s "$BASE_URL:3002/health" | jq .
curl -s "$BASE_URL:3003/health" | jq .
curl -s "$BASE_URL:3004/health" | jq .
echo ""

# Get public key
echo "2. Get Sarathi Public Key"
curl -s "$BASE_URL:3001/public-key" | jq .
echo ""

# Full workflow - Core initiates
echo "3. Initiate Full Workflow (Core → Sarathi → Bridge → Execution → Bucket)"
curl -s -X POST "$BASE_URL:3000/initiate" \
  -H "Content-Type: application/json" \
  -d '{"workload": "process-data"}' | jq .
echo ""

# Manual token generation
echo "4. Generate Token (Sarathi)"
TOKEN_RESPONSE=$(curl -s -X POST "$BASE_URL:3001/token" \
  -H "Content-Type: application/json" \
  -d '{"trace_id": "test-trace-123", "execution_id": "test-exec-456"}')
echo "$TOKEN_RESPONSE" | jq .
TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.token')
echo ""

# Manual bridge call
echo "5. Call Bridge with Token"
curl -s -X POST "$BASE_URL:3002/execute" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"workload": "manual-task", "trace_id": "test-trace-123", "execution_id": "test-exec-456"}' | jq .
echo ""

# Retrieve artifact
echo "6. Retrieve Artifact (Bucket)"
curl -s "$BASE_URL:3004/retrieve/test-trace-123/test-exec-456" | jq .
echo ""

echo "=== End of Examples ==="
