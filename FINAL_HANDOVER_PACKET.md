# TANTRA Gated Bridge — Final Handover Packet

## 1. System Overview

TANTRA is a zero-trust, hard-fail distributed execution pipeline with append-only replay survivability. It routes workload execution through 6 microservices where each service has a narrowly scoped authority and zero trust of its neighbors.

**Repository:** `https://github.com/Ranjitbackhole71/TANTRA-Gated-Bridge-Infrastructure.git`  
**Branch:** `master`  
**Last Verified:** 2026-07-09 — All 6 services live, 99/99 tests pass  
**Root Directory:** `services/` (canonical), `tantra_gated_bridge/` (frozen snapshot)

---

## 2. Architecture

### Topology

```
Core (:3000) → Sarathi (:3001) → Bridge (:3002) → Execution (:3003) → Bucket (:3004)
                                                                    ↓
                                                            InsightFlow (:3005)
```

### Service Roles

| Service | Port | Role | Authority |
|---|---|---|---|
| Core | 3000 | Entry point, UUID generation | Generate trace_id + execution_id, initiate flow |
| Sarathi | 3001 | JWT authority, RS256 + EdDSA signing | Sole token issuer |
| Bridge | 3002 | Passive forwarder, JWT validation | Zero — cannot sign, execute, or store |
| Execution | 3003 | Workload execution, adapter pattern | Verify bridge signature, execute, store artifact |
| Bucket | 3004 | SQLite artifact storage | Persist + read-after-write verify |
| InsightFlow | 3005 | Telemetry receiver (optional) | Passive telemetry ingestion |

### Service Dependencies

```
Core → Sarathi (token request)
Bridge → Sarathi (JWKS fetch)
Bridge → Execution (forward workload)
Execution → Bucket (store artifact)
Execution → InsightFlow (telemetry, async)
```

---

## 3. Deployment Steps

### Prerequisites

- Node.js 18+
- npm
- Docker Desktop (optional, for containerized deployment)

### Environment Variables

Each service has its own `.env` file in `services/<service>/.env`:

**Core** (`services/core/.env`)
```
PORT=3000
SARATHI_URL=http://localhost:3001
BRIDGE_URL=http://localhost:3002
```

**Sarathi** (`services/sarathi/.env`)
```
PORT=3001
ISSUER=tantra-sarathi
JWT_EXPIRY=1h
JWT_EXPIRY_MS=3600000
```

**Bridge** (`services/bridge/.env`)
```
PORT=3002
SARATHI_URL=http://localhost:3001
EXECUTION_URL=http://localhost:3003
INSIGHTFLOW_URL=http://localhost:3005
INSIGHTFLOW_API_KEY=dev-key
INSIGHTFLOW_ENABLED=true
```

**Execution** (`services/execution/.env`)
```
PORT=3003
SARATHI_URL=http://localhost:3001
BUCKET_URL=http://localhost:3004
EXECUTION_PARTICIPANT=./execution_participant.js
```

**Bucket** (`services/bucket/.env`)
```
PORT=3004
```

### Native Startup (per-service)

```powershell
# Terminal 1: Sarathi (must start first — provides JWKS)
cd services/sarathi && npm install && node app.js

# Terminal 2: Bucket (must start before Execution)
cd services/bucket && npm install && node app.js

# Terminal 3: Execution
cd services/execution && npm install && node app.js

# Terminal 4: Bridge
cd services/bridge && npm install && node app.js

# Terminal 5: Core
cd services/core && npm install && node app.js
```

### Native Startup (single command)

```powershell
.\scripts\start.ps1
```

### Docker Startup

```bash
cd services && docker compose build && docker compose up -d
```

### Verify

```powershell
# Health check all services
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
```

---

## 4. Recovery Steps

### Service Restart

If any service crashes, restart it individually. The replay log (append-only) and JTI store (disk-backed) survive restarts:

```powershell
# Find the failed service and restart
cd services/<service> && node app.js
```

### Key Recovery

If key files are lost, Sarathi auto-generates a new key pair on startup. Bridge must re-fetch JWKS:

```powershell
curl http://localhost:3001/.well-known/jwks.json
```

### Full Reset

```powershell
# Stop all services
.\scripts\stop.ps1

# Clear replay data (optional)
Remove-Item -Recurse -Force services/replay_persistence/data/*

# Restart
.\scripts\start.ps1
```

---

## 5. Runtime Flow

### Execution Sequence

1. Client sends `POST /initiate` to Core
2. Core generates `trace_id`, `execution_id`, sends to Sarathi
3. Sarathi issues JWT (RS256 or EdDSA) with `jti`, `trace_id`, `execution_id` claims
4. Bridge validates JWT via JWKS, enforces immutable IDs, rejects replay via `jti_store`
5. Bridge forwards to Execution
6. Execution verifies bridge signature, runs workload via `execution_participant.js`
7. Execution stores artifact in Bucket (SQLite, read-after-write verify)
8. Response flows back: Execution → Bridge → Client

### Key Properties

- **Immutable IDs**: `trace_id` and `execution_id` cannot be mutated (HTTP 400 on mismatch)
- **Replay Protection**: JWT `jti` claim tracked in append-only log, survives restart
- **Passive Telemetry**: All events tagged `passive: true`, never alter execution
- **Append-Only**: SHA-256 hash chain over all records, tamper-evident

---

## 6. Known Limitations

1. **Execution Workload is Simulated** — `executeWorkload` uses `setTimeout` (100ms). Set `EXECUTION_PARTICIPANT` env var for real compute.

2. **InsightFlow is Local Only** — Local receiver on port 3005 is operational for telemetry ingestion. No external InsightFlow endpoint connected.

3. **Replay Cache is In-Memory** — JTI cache in Bridge is in-memory `Set`. Restart clears it. `warmJtiCache()` replays JTIs from disk on startup. Tokens have 1h expiry. For production, use Redis or SQLite.

4. **No Cross-Node Replication** — Replay log is local filesystem. Distributed deployment needs shared storage.

5. **No Automatic Key Rotation** — Manual via `key_persistence.rotateKeys()` or API.

6. **No mTLS** — Service-to-service is plain HTTP. Add mTLS for production.

7. **No Secrets Manager** — Keys via env vars or files. Use Vault/AWS Secrets Manager for production.

8. **Single-Instance Services** — No horizontal scaling. Docker Compose restart policy handles recovery.

9. **No Rate Limiting** — Docker resource limits provide some protection. Add API gateway for production.

10. **No CI/CD Pipeline** — Docker Compose provides reproducible builds. Add GitHub Actions for production.

---

## 7. Future Improvements

- Redis-based JTI cache for multi-instance Bridge
- Shared/networked replay log storage
- Scheduled automatic key rotation
- mTLS between all services
- Secrets management integration
- Real compute integration via custom execution participants
- External InsightFlow endpoint connection
- Horizontal scaling for Bridge and Execution

---

## 8. FAQ

**Q: What happens if Bridge restarts during execution?**  
A: The in-memory JTI cache is lost, but the append-only log preserves all JTIs. On restart, `warmJtiCache()` replays them from disk. The in-flight execution completes independently.

**Q: How are keys managed?**  
A: Sarathi loads keys from `sarathi/keys/`. If files don't exist, new keys are generated and persisted. Rotation archives previous keys.

**Q: Can trace_id be spoofed?**  
A: No. It's embedded in the JWT (signed by Sarathi) and enforced by Bridge. Any mutation returns HTTP 400.

**Q: What happens if Bucket is unavailable?**  
A: Execution returns 503 with `{error: "System stopped"}`. The failure is recorded in the replay log.

**Q: How do I run survivability tests?**  
```bash
cd services/survivability_tests && node test_suite.js --proof
```

---

## 9. Ownership Boundaries

| Component | Owner | Location |
|---|---|---|
| Core service | TANTRA | `services/core/app.js` (85 lines) |
| Sarathi (JWT authority) | TANTRA | `services/sarathi/app.js` (128 lines) |
| Bridge (forwarder) | TANTRA | `services/bridge/app.js` (235 lines) |
| Execution (workload) | TANTRA | `services/execution/app.js` (201 lines) |
| Bucket (storage) | TANTRA | `services/bucket/app.js` (163 lines) |
| Replay persistence | TANTRA | `services/replay_persistence/` (4 modules, 378 lines total) |
| Replay reconstruction | TANTRA | `services/replay_reconstruction/` (3 modules, 319 lines total) |
| Observability | TANTRA | `services/observability/` (3 modules, 321 lines total) |
| InsightFlow adapter | TANTRA | `services/insightflow/adapter.js` (passive contract) |
| Survivability tests | TANTRA | `services/survivability_tests/` (13 scenarios) |
| Deployment | TANTRA | `deployment/docker-compose.yml`, `services/docker-compose.yml` |

---

## 10. Next Engineer Quickstart

```powershell
# 1. Clone
git clone https://github.com/Ranjitbackhole71/TANTRA-Gated-Bridge-Infrastructure.git
cd TANTRA-Gated-Bridge-Infrastructure/tantra_gated_bridge

# 2. Install dependencies
cd services/sarathi && npm install
cd ../bucket && npm install
cd ../execution && npm install
cd ../bridge && npm install
cd ../core && npm install

# 3. Start InsightFlow receiver (if needed)
cd ../insightflow && node local_receiver.js

# 4. Start services (order: sarathi, bucket, execution, bridge, core)
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "app.js" -WorkingDirectory (Resolve-Path "services/sarathi")
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "app.js" -WorkingDirectory (Resolve-Path "services/bucket")
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "app.js" -WorkingDirectory (Resolve-Path "services/execution")
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "app.js" -WorkingDirectory (Resolve-Path "services/bridge")
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "app.js" -WorkingDirectory (Resolve-Path "services/core")

# 5. Verify
curl http://localhost:3001/health
curl http://localhost:3004/health
curl http://localhost:3003/health
curl http://localhost:3002/health
curl http://localhost:3000/health

# 6. Execute a workload
$body = @{ workload = "hello-tantra" } | ConvertTo-Json
curl -X POST http://localhost:3000/initiate -H "Content-Type: application/json" -d $body

# 7. View proof documents
Get-Content RUNTIME_EXECUTION_PROOF.md
Get-Content KEY_ROTATION_PROOF.md
Get-Content REPLAY_DURABILITY_PROOF.md
Get-Content INSIGHTFLOW_ACTIVATION_PROOF.md
```
