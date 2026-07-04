#!/bin/bash
# TANTRA STOP — Gracefully stop all services
# Usage: bash scripts/stop.sh [docker|native]

set -e

MODE=${1:-docker}

echo "========================================"
echo "  TANTRA Infrastructure — STOP"
echo "========================================"

if [ "$MODE" = "docker" ] || [ "$MODE" = "d" ]; then
  echo "Mode: Docker Compose"
  echo ""
  
  cd "$(dirname "$0")/../services"
  
  echo "Stopping services..."
  docker-compose down --timeout 5
  
  echo ""
  echo "========================================"
  echo "  All Docker services stopped"
  echo "========================================"
  
elif [ "$MODE" = "native" ] || [ "$MODE" = "n" ]; then
  echo "Mode: Native (Node.js)"
  echo ""
  
  PID_FILE="$(dirname "$0")/../tantra.pids"
  
  if [ ! -f "$PID_FILE" ]; then
    echo "No PID file found. Attempting to find and kill processes..."
    # Fallback: kill by port
    for port in 3000 3001 3002 3003 3004; do
      pid=$(lsof -ti:$port 2>/dev/null || true)
      if [ -n "$pid" ]; then
        echo "  Stopping process on port $port (PID: $pid)..."
        kill -TERM "$pid" 2>/dev/null || true
      fi
    done
    echo ""
    echo "Waiting for processes to exit..."
    sleep 3
    echo "========================================"
    echo "  All services stopped"
    echo "========================================"
    exit 0
  fi
  
  echo "Reading PID file: $PID_FILE"
  while IFS= read -r pid; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      echo "  Sending SIGTERM to PID $pid..."
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done < "$PID_FILE"
  
  echo ""
  echo "Waiting for processes to exit gracefully..."
  sleep 3
  
  # Force kill any remaining
  while IFS= read -r pid; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      echo "  Force killing PID $pid..."
      kill -9 "$pid" 2>/dev/null || true
    fi
  done < "$PID_FILE"
  
  rm -f "$PID_FILE"
  
  echo ""
  echo "========================================"
  echo "  All native services stopped"
  echo "========================================"
  
else
  echo "Usage: bash scripts/stop.sh [docker|native]"
  exit 1
fi
