#!/bin/bash
set -e

echo "=========================================="
echo " TANTRA Gated Bridge - Stopping Full Stack"
echo "=========================================="

COMPOSE_FILE="../deployment/docker-compose.yml"
if [ ! -f "$COMPOSE_FILE" ]; then
    COMPOSE_FILE="./deployment/docker-compose.yml"
fi

docker compose -f "$COMPOSE_FILE" down

echo ""
echo "Stack stopped and cleaned up."
