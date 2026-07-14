# TANTRA Gated Bridge — Supported Runtime Modes

**Version**: 1.0.0
**Date**: 2026-07-14

---

## 1. Overview

TANTRA Gated Bridge supports two primary runtime modes. All 5 core services (Core, Sarathi, Bridge, Execution, Bucket) run identically in both modes. InsightFlow is optional in both.

---

## 2. Docker Mode (Recommended)

### Prerequisites

- Docker CLI 20.10+
- Docker Compose V2 (2.0+) or Docker Compose V1 (1.29+)
- 2 GB RAM available for containers

### Startup

```bash
cd services
docker compose up -d --build
```

### Verification

```bash
docker compose ps
curl http://localhost:3000/health
```

### Service Mapping

| Service | Container Name | Port | Network |
|---|---|---|---|
| Core | `core` | 3000 | `tantra-network` |
| Sarathi | `sarathi` | 3001 | `tantra-network` |
| Bridge | `bridge` | 3002 | `tantra-network` |
| Execution | `execution` | 3003 | `tantra-network` |
| Bucket | `bucket` | 3004 | `tantra-network` |

### Volumes

| Volume | Purpose | Persistence |
|---|---|---|
| `bucket-data` | SQLite database | Survives `docker compose down` |

### Restart Policy

All containers use `restart: unless-stopped`.

### Teardown

```bash
cd services
docker compose down
```

### Key Files

| File | Location | Purpose |
|---|---|---|
| `docker-compose.yml` | `services/` | Canonical compose file (5 services) |
| `Dockerfile` | `services/core/` | Core container build |
| `Dockerfile` | `services/sarathi/` | Sarathi container build |
| `Dockerfile` | `services/bridge/` | Bridge container build |
| `Dockerfile` | `services/execution/` | Execution container build |
| `Dockerfile` | `services/bucket/` | Bucket container build |
| `docker-compose.yml` | `deployment/` | Production compose with env vars and volumes |
| `docker-compose.survivability.yml` | `deployment/` | Test overlay for survivability scenarios |

---

## 3. Native Mode (Node.js)

### Prerequisites

- Node.js 18+
- npm

### Startup (Single Command)

```bash
# Linux/macOS
bash scripts/start.sh native

# Windows PowerShell
.\scripts\start.ps1 -Mode native
```

### Startup (Manual, per-service)

Startup order matters. Sarathi must start first (provides JWKS).

```bash
# 1. Sarathi (must start first)
cd services/sarathi && npm install && node app.js &

# 2. Bucket (must start before Execution)
cd services/bucket && npm install && node app.js &

# 3. Execution
cd services/execution && npm install && node app.js &

# 4. Bridge
cd services/bridge && npm install && node app.js &

# 5. Core (last)
cd services/core && npm install && node app.js &
```

### Verification

```bash
bash scripts/verify.sh
# or PowerShell:
.\scripts\verify.ps1
```

### Convergence Proof

```bash
bash scripts/convergence_proof.sh
# or PowerShell:
.\scripts\convergence_proof.ps1
```

### Teardown

```bash
# Linux/macOS
bash scripts/stop.sh

# Windows PowerShell
.\scripts\stop.ps1
```

---

## 4. Environment Configuration

### Per-Service Environment Variables

| Service | File | Required Variables |
|---|---|---|
| Core | `services/core/.env` | `PORT`, `SARATHI_URL`, `BRIDGE_URL` |
| Sarathi | `services/sarathi/.env` | `PORT`, `ISSUER`, `JWT_EXPIRY`, `JWT_EXPIRY_MS` |
| Bridge | `services/bridge/.env` | `PORT`, `SARATHI_URL`, `EXECUTION_URL`, `INSIGHTFLOW_URL`, `INSIGHTFLOW_API_KEY`, `INSIGHTFLOW_ENABLED` |
| Execution | `services/execution/.env` | `PORT`, `SARATHI_URL`, `BUCKET_URL`, `EXECUTION_PARTICIPANT` |
| Bucket | `services/bucket/.env` | `PORT` |

### Global Environment Template

| File | Location |
|---|---|
| `.env.example` | `tantra_gated_bridge/configs/` |

---

## 5. Mode Comparison

| Property | Docker Mode | Native Mode |
|---|---|---|
| Isolation | Container per service | Process per service |
| Startup Order | Managed by `depends_on` | Manual (Sarathi first) |
| Network | `tantra-network` (bridge) | `localhost` |
| Persistence | Named volumes | Local filesystem |
| Restart | Automatic (`unless-stopped`) | Manual |
| Debugging | `docker compose logs` | Direct stdout/stderr |
| Resource Limits | Compose `deploy.resources` | OS limits |
| Development | Rebuild images | Direct file editing |

---

## 6. InsightFlow Mode

| Mode | Configuration | Status |
|---|---|---|
| Local Receiver | `services/insightflow/local_receiver.js` on port 3005 | Operational |
| Remote Adapter | `INSIGHTFLOW_URL`, `INSIGHTFLOW_API_KEY`, `INSIGHTFLOW_ENABLED=true` | Contract-only (stub) |
| Disabled | `INSIGHTFLOW_ENABLED=false` or not set | Default |

### Local Receiver Startup

```bash
cd services/insightflow && node local_receiver.js
```

---

## 7. Setu Mode

| Component | Port | Status |
|---|---|---|
| Setu (FastAPI) | 8000 | Operational |
| Setu → Core → Sarathi → Bridge → Execution → Bucket | — | Full lifecycle verified |

### Setu Startup

```bash
cd setu
pip install -r requirements.txt
python app.py
```

---

## References

| Document | Location |
|---|---|
| Deployment Guide | `docs/DEPLOYMENT.md` |
| Configuration | `docs/CONFIGURATION.md` |
| Architecture | `docs/ARCHITECTURE.md` |
| Startup Scripts | `scripts/start.sh`, `scripts/start.ps1` |
| Docker Compose | `services/docker-compose.yml` |
