#!/bin/bash
set -e

echo "=========================================="
echo " TANTRA Gated Bridge - Starting Full Stack"
echo "=========================================="
echo ""

COMPOSE_FILE="../deployment/docker-compose.yml"
if [ ! -f "$COMPOSE_FILE" ]; then
    COMPOSE_FILE="./deployment/docker-compose.yml"
fi

echo "[1/3] Building images..."
docker compose -f "$COMPOSE_FILE" build

echo "[2/3] Starting services..."
docker compose -f "$COMPOSE_FILE" up -d

echo "[3/3] Waiting for health checks..."
sleep 5

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
        echo "  [$svc] HEALTHY (port $port)"
    else
        echo "  [$svc] UNHEALTHY (port $port) - HTTP $status"
    fi
done

echo ""
echo "=========================================="
echo " Stack is running"
echo " Core:      http://localhost:3000"
echo " Sarathi:   http://localhost:3001"
echo " Bridge:    http://localhost:3002"
echo " Execution: http://localhost:3003"
echo " Bucket:    http://localhost:3004"
echo "=========================================="
echo ""
echo "Test an execution:"
echo '  curl -X POST http://localhost:3000/initiate -H "Content-Type: application/json" -d '\''{"workload":"test"}'\'
