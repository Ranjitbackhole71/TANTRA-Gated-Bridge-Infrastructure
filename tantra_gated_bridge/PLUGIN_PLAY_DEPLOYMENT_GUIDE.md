# TANTRA Gated Bridge — Plug-and-Play Deployment Guide

## System Requirements

- Docker Engine 24+ with Docker Compose v2
- Node.js 18+ (for replay/reconstruction tooling)
- Git (optional, for version control)
- 2GB free RAM
- 500MB free disk

## Deployment in Under 10 Minutes

### Step 1: Clone or Copy

```bash
git clone <repo-url> tantra_gated_bridge
cd tantra_gated_bridge
```

Or extract the archive to `tantra_gated_bridge/`.

### Step 2: Start Full Stack

**Windows (PowerShell)**:
```powershell
.\scripts\start_all.ps1
```

**Linux/macOS**:
```bash
chmod +x scripts/*.sh
./scripts/start_all.sh
```

### Step 3: Verify Full Stack

**Windows**:
```powershell
.\scripts\verify_full_stack.ps1
```

**Linux/macOS**:
```bash
./scripts/verify_full_stack.sh
```

### Step 4: Test End-to-End

```bash
curl -X POST http://localhost:3000/initiate \
  -H "Content-Type: application/json" \
  -d '{"workload":"hello-world"}'
```

Expected response:
```json
{
  "trace_id": "<uuid>",
  "execution_id": "<uuid>",
  "status": "completed",
  "result": { ... }
}
```

### Step 5: Verify Replay Persistence

```bash
node -e "
const store = require('./services/replay_persistence/append_only_store');
const state = store.getChainState();
const integrity = store.validateChainIntegrity();
console.log('Records:', state.record_count);
console.log('Chain integrity:', integrity.valid ? 'PASS' : 'FAIL');
"
```

### Step 6: Run Survivability Proof

```bash
cd services/survivability_tests
node test_suite.js --proof
```

## One-Command Teardown

```bash
./scripts/stop_all.sh
```

## Health Matrix

```bash
./scripts/health_matrix.sh
```

## Deployment Configuration

### Environment Variables

Copy `configs/.env.example` to `.env` and customize:

```bash
cp configs/.env.example .env
```

Key variables:
| Variable | Default | Description |
|---|---|---|
| CORE_PORT | 3000 | Core service port |
| SARATHI_PORT | 3001 | Sarathi authority port |
| BRIDGE_PORT | 3002 | Bridge service port |
| EXECUTION_PORT | 3003 | Execution service port |
| BUCKET_PORT | 3004 | Bucket storage port |
| JWT_EXPIRY | 1h | Token expiry duration |

### Docker Compose

Primary compose file: `deployment/docker-compose.yml`

Override for local development:
```bash
docker compose -f deployment/docker-compose.yml up -d
```

## Fresh-Machine Validation Checklist

- [ ] Docker installed and running (`docker info`)
- [ ] Node.js 18+ installed (`node --version`)
- [ ] No services listening on ports 3000-3004
- [ ] `./scripts/start_all.sh` completes without errors
- [ ] All 5 services report healthy via `/health`
- [ ] `./scripts/verify_full_stack.sh` reports PASS
- [ ] End-to-end curl returns completed status
- [ ] `./scripts/stop_all.sh` cleans up cleanly

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Port conflict | Service already running | `netstat -ano | findstr :3000-3004`; kill conflicting process |
| Docker not found | Docker not installed | Install Docker Desktop |
| Node not found | Node not installed | Install Node.js 18+ |
| Chain integrity FAIL | Replay log corrupted | Delete `data/replay_*.json*` and restart |
| Bridge unhealthy | Sarathi not ready | Wait 10s; check `docker compose logs bridge` |
| Health check timeout | Docker network issue | `docker compose down; docker compose up -d` |

## Cold-Start Verification

After a fresh clone on a machine with only Docker and Node.js:

```bash
# Total time: < 10 minutes
cp configs/.env.example .env
chmod +x scripts/*.sh
./scripts/start_all.sh          # ~2 minutes (build + start)
sleep 10                        # ~10 seconds (service readiness)
./scripts/verify_full_stack.sh  # ~30 seconds (health + e2e + integrity)
cd services/survivability_tests
node test_suite.js --proof      # ~2 seconds (survivability)
```
