#!/bin/bash
# TANTRA START — Single command to start all services
# Usage: bash scripts/start.sh [docker|native]

set -e

MODE=${1:-docker}

echo "========================================"
echo "  TANTRA Infrastructure — START"
echo "========================================"

if [ "$MODE" = "docker" ] || [ "$MODE" = "d" ]; then
  echo "Mode: Docker Compose"
  echo ""
  
  # Check Docker
  if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker not found"
    exit 1
  fi
  
  cd "$(dirname "$0")/../services"
  
  # Build if needed
  if [ ! -z "$(docker images -q services-core 2>/dev/null)" ]; then
    echo "Images exist, skipping build"
  else
    echo "Building images..."
    docker-compose build
  fi
  
  echo "Starting services..."
  docker-compose up -d
  
  echo ""
  echo "Waiting for services to be ready..."
  sleep 3
  
  # Verify all services
  echo ""
  echo "Health check:"
  for port in 3000 3001 3002 3003 3004; do
    result=$(curl -s --connect-timeout 2 http://localhost:$port/health 2>/dev/null || echo "DOWN")
    echo "  Port $port: $result"
  done
  
  echo ""
  echo "========================================"
  echo "  All services started"
  echo "  Core:      http://localhost:3000"
  echo "  Sarathi:   http://localhost:3001"
  echo "  Bridge:    http://localhost:3002"
  echo "  Execution: http://localhost:3003"
  echo "  Bucket:    http://localhost:3004"
  echo "========================================"
  
elif [ "$MODE" = "native" ] || [ "$MODE" = "n" ]; then
  echo "Mode: Native (Node.js)"
  echo ""
  
  cd "$(dirname "$0")/../services"
  
  PID_FILE="$(dirname "$0")/../tantra.pids"
  rm -f "$PID_FILE"
  touch "$PID_FILE"
  
  echo "Starting Core..."
  cd core && node app.js &
  echo $! >> "$PID_FILE"
  cd ..
  
  sleep 1
  echo "Starting Sarathi..."
  cd sarathi && node app.js &
  echo $! >> "$PID_FILE"
  cd ..
  
  sleep 1
  echo "Starting Bridge..."
  cd bridge && node app.js &
  echo $! >> "$PID_FILE"
  cd ..
  
  sleep 1
  echo "Starting Execution..."
  cd execution && node app.js &
  echo $! >> "$PID_FILE"
  cd ..
  
  sleep 1
  echo "Starting Bucket..."
  cd bucket && node app.js &
  echo $! >> "$PID_FILE"
  cd ..
  
  echo ""
  echo "PIDs written to: $PID_FILE"
  echo "Waiting for services to be ready..."
  sleep 3
  
  echo ""
  echo "Health check:"
  for port in 3000 3001 3002 3003 3004; do
    result=$(curl -s --connect-timeout 2 http://localhost:$port/health 2>/dev/null || echo "DOWN")
    echo "  Port $port: $result"
  done
  
  echo ""
  echo "========================================"
  echo "  All services started (native mode)"
  echo "  Stop with: bash scripts/stop.sh native"
  echo "========================================"
  
else
  echo "Usage: bash scripts/start.sh [docker|native]"
  exit 1
fi
