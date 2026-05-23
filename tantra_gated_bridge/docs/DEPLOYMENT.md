# TANTRA Gated Bridge — Deployment Guide

## Architecture Overview

Docker Compose stack with 5 services on a shared bridge network.

## Prerequisites

- Docker Engine 24+ with Docker Compose v2 plugin
- Node.js 18+ (for replay/reconstruction tools)
- Git (optional)

## Directory Structure

```
tantra_gated_bridge/
├── deployment/docker-compose.yml        # Main compose file
├── scripts/                             # One-command operations
├── configs/.env.example                 # Environment template
└── services/                            # Service source code
```

## Deployment Steps

### Step 1: Environment Setup

```bash
cd tantra_gated_bridge
cp configs/.env.example .env
```

Edit `.env` to customize ports or RSA keys if needed. Defaults work for local deployment.

### Step 2: Start Stack

**Windows PowerShell**:
```powershell
.\scripts\start_all.ps1
```

**Linux/macOS**:
```bash
chmod +x scripts/*.sh
./scripts/start_all.sh
```

### Step 3: Verify

```bash
./scripts/verify_full_stack.sh
```

### Step 4: Run End-to-End Test

```bash
curl -X POST http://localhost:3000/initiate \
  -H "Content-Type: application/json" \
  -d '{"workload":"test"}'
```

### Step 5: Run Survivability Proof

```bash
cd services/survivability_tests
node test_suite.js --proof
```

### Step 6: Run Real Lifecycle Tests

```bash
./run_lifecycle_tests.sh
```

### Step 7: Run Ecosystem Proof

```bash
node ecosystem_proof.js
```

## Docker Compose Details

### Production Compose

File: `deployment/docker-compose.yml`

- 5 services on `tantra-network` (bridge driver)
- Ports 3000-3004 mapped to host
- Service dependencies enforced at application layer
- `restart: unless-stopped` for resilience

### Survivability Test Overlay

File: `deployment/docker-compose.survivability.yml`

- Adds survivability-tests service
- Profile-gated (`--profile survivability`)

### Manual Docker Commands

```bash
# Build and start
docker compose -f deployment/docker-compose.yml up -d --build

# View logs
docker compose -f deployment/docker-compose.yml logs -f

# Stop
docker compose -f deployment/docker-compose.yml down

# Stop with volume cleanup
docker compose -f deployment/docker-compose.yml down -v
```

## Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `CORE_PORT` | 3000 | No | Core service port |
| `CORE_SARATHI_URL` | `http://sarathi:3001` | No | Sarathi service URL |
| `CORE_BRIDGE_URL` | `http://bridge:3002` | No | Bridge service URL |
| `SARATHI_PORT` | 3001 | No | Sarathi service port |
| `SARATHI_ISSUER` | `tantra-sarathi` | No | JWT issuer claim |
| `PRIVATE_KEY` | auto-generated | No | RSA private key (PEM) |
| `PUBLIC_KEY` | auto-generated | No | RSA public key (PEM) |
| `JWT_EXPIRY` | `1h` | No | JWT expiry duration |
| `JWT_EXPIRY_MS` | 3600000 | No | JWT expiry in ms |
| `BRIDGE_PORT` | 3002 | No | Bridge service port |
| `BRIDGE_SARATHI_URL` | `http://sarathi:3001` | No | Sarathi URL for bridge |
| `BRIDGE_EXECUTION_URL` | `http://execution:3003` | No | Execution URL for bridge |
| `EXECUTION_PORT` | 3003 | No | Execution service port |
| `EXECUTION_SARATHI_URL` | `http://sarathi:3001` | No | Sarathi URL for execution |
| `EXECUTION_BUCKET_URL` | `http://bucket:3004` | No | Bucket URL for execution |
| `BUCKET_PORT` | 3004 | No | Bucket service port |
| `REPLAY_STORAGE_DIR` | `/app/data` | No | Replay log directory |

## Health Endpoints

Each service exposes `GET /health` returning:
```json
{ "service": "<name>", "status": "healthy" }
```

Ports:
- Core: 3000
- Sarathi: 3001
- Bridge: 3002
- Execution: 3003
- Bucket: 3004

## Verification Commands

| Check | Command |
|---|---|
| All services healthy | `./scripts/health_matrix.sh` |
| Full stack verification | `./scripts/verify_full_stack.sh` |
| Chain integrity | `node -e "const s=require('./services/replay_persistence/append_only_store');console.log(s.validateChainIntegrity().valid?'PASS':'FAIL')"` |
| Replay reconstruction | `node services/replay_reconstruction/reconstruction_tool.js <trace_id>` |
| Survivability proof | `cd services/survivability_tests && node test_suite.js --proof` |
| Lifecycle proof | `cd services/survivability_tests && ./run_lifecycle_tests.sh` |
| Ecosystem proof | `cd services/survivability_tests && node ecosystem_proof.js` |
