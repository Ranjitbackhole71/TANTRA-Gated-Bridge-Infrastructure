#!/bin/bash
# TANTRA Gated Bridge - Health Matrix
# Displays a color-coded health status for all services

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo " TANTRA Gated Bridge - Health Matrix"
echo " $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "=========================================="
echo ""

SERVICES=("core:3000" "sarathi:3001" "bridge:3002" "execution:3003" "bucket:3004")

ALL_HEALTHY=true
for entry in "${SERVICES[@]}"; do
    NAME="${entry%%:*}"
    PORT="${entry##*:}"
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/health" --max-time 3 2>/dev/null || echo "000")
    
    if [ "$HTTP_CODE" = "200" ]; then
        printf "  ${GREEN}[UP]${NC}   %-12s :%-4s HTTP 200\n" "$NAME" "$PORT"
    elif [ "$HTTP_CODE" = "000" ]; then
        printf "  ${RED}[DOWN]${NC} %-12s :%-4s unreachable\n" "$NAME" "$PORT"
        ALL_HEALTHY=false
    else
        printf "  ${YELLOW}[DEG]${NC} %-12s :%-4s HTTP %s\n" "$NAME" "$PORT" "$HTTP_CODE"
        ALL_HEALTHY=false
    fi
done

echo ""
echo "Dependency chain health:"
echo "  Core(3000) -> Sarathi(3001) -> Bridge(3002) -> Execution(3003) -> Bucket(3004)"

# Check end-to-end
echo ""
echo "End-to-end check:"
E2E_RESPONSE=$(curl -s -X POST http://localhost:3000/initiate \
  -H "Content-Type: application/json" \
  -d '{"workload":"health-check"}' \
  --max-time 15 2>/dev/null || echo '{"status":"failed"}')

if echo "$E2E_RESPONSE" | grep -q '"completed"'; then
    printf "  ${GREEN}[PASS]${NC} End-to-end execution successful\n"
else
    printf "  ${RED}[FAIL]${NC} End-to-end execution failed\n"
    ALL_HEALTHY=false
fi

echo ""
if [ "$ALL_HEALTHY" = true ]; then
    printf "  ${GREEN}ALL SYSTEMS HEALTHY${NC}\n"
    exit 0
else
    printf "  ${RED}SOME SYSTEMS UNHEALTHY${NC}\n"
    exit 1
fi
