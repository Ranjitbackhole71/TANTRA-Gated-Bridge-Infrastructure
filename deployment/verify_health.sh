#!/bin/bash
# AIAIC Platform Runtime - Health Verification Script
# Usage: ./verify_health.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8000}"
TIMEOUT=10

log_info() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

# Test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    
    log_step "Testing: $name"
    
    response=$(curl -sf --max-time $TIMEOUT "$url" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        log_info "$name is healthy"
        return 0
    else
        log_error "$name is not responding"
        return 1
    fi
}

# Main
main() {
    echo "=========================================="
    echo "AIAIC Platform Health Verification"
    echo "=========================================="
    echo ""
    
    local total=0
    local passed=0
    local failed=0
    
    # Test Gateway
    total=$((total + 1))
    if test_endpoint "Gateway Root" "$GATEWAY_URL/"; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi
    
    # Test Health Endpoint
    total=$((total + 1))
    if test_endpoint "Health Check" "$GATEWAY_URL/platform/health"; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi
    
    # Test Services Endpoint
    total=$((total + 1))
    if test_endpoint "Services List" "$GATEWAY_URL/platform/services"; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi
    
    # Test Runtime Endpoint
    total=$((total + 1))
    if test_endpoint "Runtime Status" "$GATEWAY_URL/platform/runtime"; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi
    
    # Test Metrics Endpoint
    total=$((total + 1))
    if test_endpoint "Metrics" "$GATEWAY_URL/platform/metrics"; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi
    
    # Test Version Endpoint
    total=$((total + 1))
    if test_endpoint "Version" "$GATEWAY_URL/platform/version"; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi
    
    # Test Config Endpoint
    total=$((total + 1))
    if test_endpoint "Config" "$GATEWAY_URL/platform/config"; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi
    
    # Test Swagger
    total=$((total + 1))
    if test_endpoint "Swagger Docs" "$GATEWAY_URL/docs"; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi
    
    # Summary
    echo ""
    echo "=========================================="
    echo "Verification Summary"
    echo "=========================================="
    echo ""
    echo -e "Total Tests:  $total"
    echo -e "${GREEN}Passed:       $passed${NC}"
    echo -e "${RED}Failed:       $failed${NC}"
    echo ""
    
    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}Some tests failed!${NC}"
        exit 1
    fi
}

main
