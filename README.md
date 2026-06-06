# TANTRA Gated Bridge

Zero-trust, hard-fail distributed infrastructure pipeline.

## Architecture

```
Core (:3000) → Sarathi (:3001) → Bridge (:3002) → Execution (:3003) → Bucket (:3004)
```

## Quick Start

### START (single command)

```bash
# Docker
bash scripts/start.sh docker

# Native (Node.js)
bash scripts/start.sh native
```

**Windows PowerShell:**
```powershell
.\scripts\start.ps1 -Mode docker
```

### VERIFY (single command)

```bash
bash scripts/verify.sh
```

**Windows PowerShell:**
```powershell
.\scripts\verify.ps1
```

### FULL CONVERGENCE PROOF (single command)

```bash
bash scripts/convergence_proof.sh
```

**Windows PowerShell:**
```powershell
.\scripts\convergence_proof.ps1
```

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| Real Execution Integration | COMPLETE | 5 services, adapter pattern, execution contract |
| InsightFlow Participation | PARTIAL | Contract + adapter + proof harness (no live InsightFlow) |
| Distributed Replay | COMPLETE | Append-only log, SHA-256 chain, idempotency, reconstruction |
| Sarathi Authority Durability | COMPLETE | Key persistence, rotation support, restart-safe |
| Degraded Survivability | COMPLETE | 13 scenarios (7 core + 6 enhanced) |
| Plug-and-Play Packaging | COMPLETE | START/VERIFY/CONVERGENCE commands, Docker, env template |
| Review Packet | COMPLETE | REVIEW_PACKET_FINAL_COMPLETION.md |
| Testing Packet | COMPLETE | TESTING_PACKET_VINAYAK.md |

## Services

| Service | Port | Role |
|---------|------|------|
| Core | 3000 | Entry point, generates UUIDs |
| Sarathi | 3001 | JWT authority (RS256) |
| Bridge | 3002 | Passive forwarding only |
| Execution | 3003 | Workload execution (adapter-based) |
| Bucket | 3004 | SQLite artifact storage |

## Key Features

- **Zero-trust**: Every service validates JWTs, no fallback paths
- **Replay protection**: jti claim prevents token replay
- **Immutable trace**: trace_id/execution_id enforced across all services
- **Persistent storage**: SQLite with read-after-write verification
- **Replay persistence**: Append-only SHA-256 hash chain
- **Survivability**: 13 scenarios proving failure recovery
