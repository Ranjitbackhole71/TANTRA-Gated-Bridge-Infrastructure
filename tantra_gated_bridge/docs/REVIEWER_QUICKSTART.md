# REVIEWER QUICKSTART

## Prerequisites
- Node.js 18+
- npm (dependencies installed)

## 1. Start Services (Windows)
```bat
cd services\core
start /B node app.js

cd ..\sarathi
start /B node app.js

cd ..\bridge
start /B node app.js

cd ..\execution
start /B node app.js

cd ..\bucket
start /B node app.js
```

### Or with docker-compose
```bash
cd services
docker-compose up -d
```

## 2. Verify All Services
```bash
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
```

## 3. Run Full E2E Workflow
```bash
curl -X POST http://localhost:3000/initiate \
  -H "Content-Type: application/json" \
  -d '{"workload": "reviewer-test"}' | jq .
```

## 4. Run Verification Scripts
```bash
# Linux/Mac (from services/ directory)
bash ../scripts/verify_services.sh
bash ../scripts/demo_flow.sh
bash ../tests/replay_test.sh
bash ../tests/trace_integrity_test.sh
bash ../tests/bucket_persistence_test.sh
bash ../scripts/master_verification.sh

# Windows (from services/ directory)
..\scripts\master_verification.bat
```

## 5. Check Proof Documents
| Document | What it proves |
|----------|---------------|
| `services/REPLAY_PROOF.md` | Replay attack → 401 |
| `services/LIVE_EXECUTION_PROOF.md` | E2E flow with real outputs |
| `services/BRIDGE_AUDIT.md` | Bridge has zero forbidden logic |
| `services/FAILURE_PROOF.md` | All failure scenarios |
| `services/FINAL_SANITY_CHECK.md` | All files exist, all tests pass |

## 6. Key Architecture Points
- **5 separate services** on 5 separate ports (3000-3004)
- **Sarathi only** generates JWT tokens (RS256)
- **Bridge only** validates and forwards (no token gen, no execution)
- **Bucket** uses SQLite with read-after-write verification
- **trace_id/execution_id** immutable across all 5 services
- **No fallback paths** — all failures stop the system immediately
