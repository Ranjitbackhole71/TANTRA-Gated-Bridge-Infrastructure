#!/bin/bash

# MASTER_VERIFICATION.SH - Run all verification tests
# This is the single entry point for reviewers to verify entire system

set -e

echo "=========================================="
echo "TANTRA PHASE 2 VERIFICATION SUITE"
echo "=========================================="
echo ""
echo "This script will verify:"
echo "  1. Service separation (ports, processes)"
echo "  2. Replay protection (jti enforcement)"
echo "  3. Bucket persistence (SQLite)"
echo "  4. Trace integrity (immutable IDs)"
echo "  5. Failure propagation (hard stops)"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Track results
ALL_PASSED=true

# Check if services are running
echo "=========================================="
echo "PREREQUISITE: CHECKING SERVICES"
echo "=========================================="
echo ""

SERVICES_UP=true
for port in 3000 3001 3002 3003 3004; do
  if curl -s --connect-timeout 2 "http://localhost:$port/health" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Port $port responding"
  else
    echo -e "  ${RED}✗${NC} Port $port NOT responding"
    SERVICES_UP=false
  fi
done

if [ "$SERVICES_UP" = false ]; then
  echo ""
  echo -e "${RED}ERROR: Not all services are running${NC}"
  echo "Start services with:"
  echo "  docker-compose up -d"
  echo "  OR"
  echo "  Run each service manually from its directory"
  exit 1
fi
echo ""

# Run verification tests
echo "=========================================="
echo "TEST 1: SERVICE SEPARATION"
echo "=========================================="
if bash scripts/verify_services.sh; then
  echo -e "${GREEN}✓ Service separation verified${NC}"
else
  echo -e "${RED}✗ Service separation failed${NC}"
  ALL_PASSED=false
fi
echo ""

echo "=========================================="
echo "TEST 2: REPLAY PROTECTION"
echo "=========================================="
if bash tests/replay_test.sh; then
  echo -e "${GREEN}✓ Replay protection verified${NC}"
else
  echo -e "${RED}✗ Replay protection failed${NC}"
  ALL_PASSED=false
fi
echo ""

echo "=========================================="
echo "TEST 3: BUCKET PERSISTENCE"
echo "=========================================="
if bash tests/bucket_persistence_test.sh; then
  echo -e "${GREEN}✓ Bucket persistence verified${NC}"
else
  echo -e "${RED}✗ Bucket persistence failed${NC}"
  ALL_PASSED=false
fi
echo ""

echo "=========================================="
echo "TEST 4: TRACE INTEGRITY"
echo "=========================================="
if bash tests/trace_integrity_test.sh; then
  echo -e "${GREEN}✓ Trace integrity verified${NC}"
else
  echo -e "${RED}✗ Trace integrity failed${NC}"
  ALL_PASSED=false
fi
echo ""

echo "=========================================="
echo "TEST 5: BRIDGE AUDIT (Static Analysis)"
echo "=========================================="
echo "Running static audit of Bridge service..."
echo ""

# Check for forbidden patterns
BRIDGE_CLEAN=true

if grep -q "jwt.sign\|generateToken\|createToken" services/bridge/app.js 2>/dev/null; then
  echo -e "${RED}✗ Found token generation in Bridge${NC}"
  BRIDGE_CLEAN=false
else
  echo -e "${GREEN}✓ No token generation in Bridge${NC}"
fi

if grep -q "eval\|spawn\|child_process" services/bridge/app.js 2>/dev/null; then
  echo -e "${RED}✗ Found execution logic in Bridge${NC}"
  BRIDGE_CLEAN=false
else
  echo -e "${GREEN}✓ No execution logic in Bridge${NC}"
fi

if grep -q "fallback\|backup" services/bridge/app.js 2>/dev/null; then
  echo -e "${RED}✗ Found fallback paths in Bridge${NC}"
  BRIDGE_CLEAN=false
else
  echo -e "${GREEN}✓ No fallback paths in Bridge${NC}"
fi

if [ "$BRIDGE_CLEAN" = false ]; then
  ALL_PASSED=false
else
  echo -e "${GREEN}✓ Bridge remains passive (all checks passed)${NC}"
fi
echo ""

echo "=========================================="
echo "TEST 6: FAILURE PROPAGATION"
echo "=========================================="
echo "Testing failure scenarios from FAILURE_PROOF.md..."
echo ""

# Test invalid token
HTTP_CODE=$(curl -s -o /tmp/invalid_token.txt -w "%{http_code}" -X POST http://localhost:3002/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid.token" \
  -d '{"workload":"test","trace_id":"t1","execution_id":"e1"}')

if [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✓ Invalid token blocked (401)${NC}"
else
  echo -e "${RED}✗ Invalid token not blocked (got $HTTP_CODE)${NC}"
  ALL_PASSED=false
fi
echo ""

echo "=========================================="
echo "FINAL VERIFICATION SUMMARY"
echo "=========================================="
echo ""

if [ "$ALL_PASSED" = true ]; then
  echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║   ALL PHASE 2 TESTS PASSED             ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
  echo ""
  echo "Proof artifacts generated:"
  echo "  - Terminal output (captured above)"
  echo "  - Logs available via: docker-compose logs"
  echo "  - Documentation: REVIEW_PACKET.md"
  echo "  - Failure proof: FAILURE_PROOF.md"
  echo "  - Bridge audit: BRIDGE_AUDIT.md"
  exit 0
else
  echo -e "${RED}╔══════════════════════════════════════════╗${NC}"
  echo -e "${RED}║   SOME TESTS FAILED                       ║${NC}"
  echo -e "${RED}╚══════════════════════════════════════════╝${NC}"
  echo ""
  echo "Review failed tests above and fix issues."
  exit 1
fi
