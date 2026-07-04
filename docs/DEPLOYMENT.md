# TANTRA Deployment Guide

## Prerequisites

### Docker Deployment
- Docker Engine 20.10+
- Docker Compose 2.0+
- 2GB RAM minimum
- Ports 3000-3005, 8000 available

### Native Deployment
- Node.js 18+
- npm
- Ports 3000-3005 available

## Quick Start

### Docker (Recommended)

```bash
# Start all services
bash scripts/start.sh docker

# Or on Windows PowerShell
.\scripts\start.ps1 -Mode docker
```

### Native (Node.js)

```bash
# Start all services
bash scripts/start.sh native

# Or on Windows PowerShell
.\scripts\start.ps1 -Mode native
```

## Docker Deployment

### Using Root docker-compose.yml (Full Stack)

```bash
# Build and start all services (gateway + TANTRA + Redis)
docker-compose up -d --build

# Verify health
bash scripts/verify.sh

# Stop all services
docker-compose down
```

### Using Services docker-compose.yml (TANTRA Only)

```bash
cd services

# Build and start TANTRA services
docker-compose up -d --build

# Verify health
for port in 3000 3001 3002 3003 3004 3005; do
  curl -s http://localhost:$port/health
done

# Stop
docker-compose down
```

### Docker Services

| Service | Container | Port | Network |
|---------|-----------|------|---------|
| Core | aiaic-tantra-core | 3000 | aiaic-network |
| Sarathi | aiaic-tantra-sarathi | 3001 | aiaic-network |
| Bridge | aiaic-tantra-bridge | 3002 | aiaic-network |
| Execution | aiaic-tantra-execution | 3003 | aiaic-network |
| Bucket | aiaic-tantra-bucket | 3004 | aiaic-network |
| InsightFlow | aiaic-tantra-insightflow | 3005 | aiaic-network |
| Gateway | aiaic-gateway | 8000 | aiaic-network |
| Redis | aiaic-redis | 6379 | aiaic-network |

## Native Deployment

### Start Services

```bash
bash scripts/start.sh native
```

This will:
1. Start Core on port 3000
2. Start Sarathi on port 3001
3. Start Bridge on port 3002
4. Start Execution on port 3003
5. Start Bucket on port 3004
6. Write PIDs to `tantra.pids`

### Stop Services

```bash
bash scripts/stop.sh native
```

This will:
1. Read PIDs from `tantra.pids`
2. Send SIGTERM to each process
3. Wait for graceful shutdown
4. Force kill if needed
5. Remove PID file

### Verify Services

```bash
bash scripts/verify.sh
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
```

See [CONFIGURATION.md](CONFIGURATION.md) for all available variables.

### Key Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| TANTRA_CORE_PORT | 3000 | Core service port |
| TANTRA_SARATHI_PORT | 3001 | Sarathi service port |
| TANTRA_BRIDGE_PORT | 3002 | Bridge service port |
| TANTRA_EXECUTION_PORT | 3003 | Execution service port |
| TANTRA_BUCKET_PORT | 3004 | Bucket service port |
| INSIGHTFLOW_PORT | 3005 | InsightFlow port |
| AIAIC_GATEWAY_PORT | 8000 | Gateway port |

## Volumes

### Docker Volumes

| Volume | Purpose |
|--------|---------|
| bucket-data | SQLite database persistence |
| sarathi-keys | JWT key persistence |
| insightflow-data | Telemetry data |
| redis-data | Redis persistence |
| gateway-logs | Gateway logs |
| gateway-data | Gateway data |

### Native Mode Data

| Path | Purpose |
|------|---------|
| services/sarathi/keys/ | JWT keys |
| services/replay_persistence/data/ | Replay log |
| services/bucket/bucket.db | SQLite database |
| services/execution/outputs/ | Execution outputs |
| services/insightflow/data/ | Telemetry data |

## Health Checks

### Docker Health Checks

All services have health checks configured:
- **Interval**: 30 seconds
- **Timeout**: 5 seconds
- **Retries**: 3

### Manual Health Check

```bash
# Check all services
for port in 3000 3001 3002 3003 3004; do
  curl -s http://localhost:$port/health | jq .
done
```

## Graceful Shutdown

### Docker

```bash
docker-compose down --timeout 5
```

### Native

```bash
bash scripts/stop.sh native
```

All services handle SIGTERM and SIGINT for graceful shutdown:
- Stop accepting new connections
- Complete in-flight requests
- Close database connections
- Exit cleanly

## Verification

### Full Convergence Proof

```bash
bash scripts/convergence_proof.sh
```

This runs 10 validation sections:
1. Service health
2. End-to-end workflow
3. Trace integrity
4. Replay protection
5. Failure propagation
6. Replay persistence
7. Survivability tests
8. Chain integrity
9. Key durability
10. Deployment info

### Individual Tests

```bash
# Replay protection
bash tests/replay_test.sh

# Trace integrity
bash tests/trace_integrity_test.sh

# Bucket persistence
bash tests/bucket_persistence_test.sh
```

## Troubleshooting

### Services Won't Start

1. Check port availability: `netstat -an | grep -E '300[0-4]'`
2. Check Node.js version: `node -v` (requires 18+)
3. Check npm dependencies: `cd services/core && npm install`

### Docker Build Fails

1. Check Docker version: `docker --version`
2. Check disk space: `docker system df`
3. Clean build cache: `docker system prune`

### Health Checks Failing

1. Check logs: `docker logs <container-name>`
2. Check network: `docker network inspect aiaic-network`
3. Restart service: `docker restart <container-name>`

### Replay Detection Issues

1. Check replay log: `cat services/replay_persistence/data/replay_log.jsonl`
2. Verify chain integrity: `node -e "const s = require('./services/replay_persistence/append_only_store'); console.log(s.validateChainIntegrity())"`
