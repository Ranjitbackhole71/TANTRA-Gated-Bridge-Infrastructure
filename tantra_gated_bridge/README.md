# TANTRA Gated Bridge

> **⚠️ FROZEN SNAPSHOT**: This directory is a historical snapshot of the TANTRA platform. The canonical, production-ready implementation is in the repository root `services/` directory. Do not modify files here — use `services/` for all development.

Zero-trust, hard-fail execution pipeline with append-only replay survivability.

```
Core(:3000) → Sarathi(:3001) → Bridge(:3002) → Execution(:3003) → Bucket(:3004)
```

## Quick Start

**Requirements**: Docker 24+ with Compose v2, Node.js 18+

```bash
# 1. Start full stack (under 10 minutes)
cp configs/.env.example .env
./scripts/start_all.sh

# 2. Verify everything works
./scripts/verify_full_stack.sh

# 3. Test an execution
curl -X POST http://localhost:3000/initiate \
  -H "Content-Type: application/json" \
  -d '{"workload":"hello-world"}'

# 4. Run survivability proof
cd services/survivability_tests
node test_suite.js --proof

# 5. Run real lifecycle tests (Docker)
./services/survivability_tests/run_lifecycle_tests.sh

# 6. Run ecosystem contract proof
node services/survivability_tests/ecosystem_proof.js

# 7. Stop
./scripts/stop_all.sh
```

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

### Services

| Service | Port | Role |
|---|---|---|
| core | 3000 | Entry point, trace/execution ID generation |
| sarathi | 3001 | JWT authority (RS256 signing) |
| bridge | 3002 | Passive forwarder, JWT validation, replay detection |
| execution | 3003 | Workload execution, artifact generation |
| bucket | 3004 | SQLite artifact storage with read-after-write verification |

### Supporting Modules

| Module | Purpose |
|---|---|
| `services/replay_persistence/` | Append-only JSONL log with SHA-256 hash chain |
| `services/replay_reconstruction/` | Read-only trace reconstruction, corruption detection |
| `services/observability/` | Passive telemetry emission (all events passive:true) |
| `services/survivability_tests/` | 7 survivability scenarios + lifecycle + ecosystem proofs |

## Deployment

- One-command startup: `./scripts/start_all.sh`
- One-command teardown: `./scripts/stop_all.sh`
- One-command verification: `./scripts/verify_full_stack.sh`
- Health matrix: `./scripts/health_matrix.sh`

See [PLUGIN_PLAY_DEPLOYMENT_GUIDE.md](PLUGIN_PLAY_DEPLOYMENT_GUIDE.md)

## Ecosystem Participation

TANTRA Gated Bridge participates passively via:

- **Observability contract**: All telemetry tagged `passive: true`
- **Telemetry export**: JSONL format, open schema
- **Trace continuity**: Deterministic replay, immutable records
- **Replay compatibility**: Version-agnostic reconstruction

See [docs/ECOSYSTEM_PARTICIPATION.md](docs/ECOSYSTEM_PARTICIPATION.md)

## Key Documents

| Document | Purpose |
|---|---|
| [CONSTITUTIONAL_BOUNDARY_FINAL.md](CONSTITUTIONAL_BOUNDARY_FINAL.md) | Authority and boundary declarations |
| [DISTRIBUTED_SURVIVABILITY_REVIEW.md](DISTRIBUTED_SURVIVABILITY_REVIEW.md) | Lifecycle survivability review |
| [HIDDEN_STATE_DISCLOSURE_FINAL.md](HIDDEN_STATE_DISCLOSURE_FINAL.md) | Complete state disclosure |
| [ECOSYSTEM_ALIGNMENT_NOTE.md](ECOSYSTEM_ALIGNMENT_NOTE.md) | Ecosystem participation model |
| [review_packets/REVIEW_PACKET_FINAL_CONVERGENCE.md](review_packets/REVIEW_PACKET_FINAL_CONVERGENCE.md) | Full convergence review |

## Key Principles

- **Zero trust**: Every request is validated at every hop
- **Hard fail**: Any service unavailability stops the pipeline immediately
- **No fallback paths**: No degraded modes, no mock execution in production path
- **Append-only**: Replay log is append-only, never modified
- **Read-only verification**: Reconstruction tools never write to the log
- **Passive observability**: Telemetry cannot alter execution flow
- **No governance**: TANTRA emits, it does not decide
