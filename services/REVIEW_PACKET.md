# TANTRA Infrastructure - REVIEW PACKET

## Project Overview
Distributed system with strict service boundaries and zero-trust enforcement. Every service runs independently with NO fallback paths.

## Phase 2 Update
Added verifiable execution proof:
- Real replay protection (jti claim + cache)
- SQLite-backed bucket persistence
- Trace integrity verification
- Failure proof demonstrations
- Bridge static audit (passive verification)
- Deployment validation evidence

## System Topology
```
Core (3000) → Sarathi (3001) → Bridge (3002) → Execution (3003) → Bucket (3004)
```

## Deliverables Checklist

### ✅ Phase 2 Verification Scripts
- `../scripts/verify_services.sh` - Service separation proof
- `../scripts/master_verification.sh` - Run all tests
- `../scripts/demo_flow.sh` - Full demo with proof
- `../tests/replay_test.sh` - Replay protection test
- `../tests/trace_integrity_test.sh` - ID immutability proof
- `../tests/bucket_persistence_test.sh` - SQLite persistence proof

### ✅ Phase 2 Documentation
- `FAILURE_PROOF.md` - Executable failure demonstrations
- `BRIDGE_AUDIT.md` - Static analysis proving Bridge is passive
- `DEPLOYMENT_PROOF.md` - Docker deployment validation
- `LIVE_PROOF_CHECKLIST.md` - Reviewer evidence checklist
- `terminal_demo.md` - Recording guide for live demo

### ✅ Enhanced Security
- jti claim enforcement (replay protection)
- SQLite persistence (bucket storage survives restart)
- Replay cache with TTL in Bridge and Sarathi

### ✅ Independent Services
- `core/app.js` - Entry point, initiates workflow
- `sarathi/app.js` - JWT authority (RS256 only)
- `bridge/app.js` - Passive forwarding ONLY
- `execution/app.js` - External workload execution
- `bucket/app.js` - Storage with read-after-write verification

### ✅ Deployment-Ready Architecture
- `docker-compose.yml` - Full orchestration
- Individual `Dockerfile` per service
- `.env.example` files for configuration

### ✅ API Contracts (see architecture.md)
- POST `/initiate` (Core)
- POST `/token` (Sarathi)
- POST `/execute` (Bridge)
- POST `/run` (Execution)
- POST `/store` (Bucket)

### ✅ Structured Logging
All services log with:
```json
{
  "timestamp": "ISO-8601",
  "trace_id": "uuid",
  "execution_id": "uuid",
  "service_name": "service-name",
  "status": "info|success|error",
  "message": "description"
}
```

### ✅ Middleware Enforcement
**Immutable IDs** (`bridge/app.js:45-60`, `execution/app.js:45-55`):
- trace_id and execution_id cannot be mutated
- Token claims must match body claims
- Returns 400 if mutation detected

### ✅ Hard-Fail Handling
**Bridge Service** (`bridge/app.js:82-95`):
- No retries masking failure
- Returns 503 if Execution down
- System stops immediately

**Execution Service** (`execution/app.js:87-105`):
- No fallback to local storage
- Returns 503 if Bucket down
- System stops immediately

## Zero-Trust Boundary Enforcement

### Why Fallback Was Removed
**Bridge Service** (`bridge/app.js:1-95`):
```javascript
// FORBIDDEN (removed):
// - token generation → Use Sarathi only
// - execution logic → Use Execution Service only
// - fallback paths → System must stop
// - mock execution → No local execution allowed
// - retry-based bypass → Fail immediately
```

### Why Bridge Stays Passive
**Bridge Responsibility Only** (`bridge/app.js:65-80`):
1. Validate JWT from Sarathi (issuer, expiry, signature)
2. Verify trace_id matches token
3. Verify execution_id matches token
4. Forward request to Execution Service
5. Return downstream response

**NOT Bridge's job:**
- Generating tokens (Sarathi only)
- Executing workloads (Execution only)
- Storing artifacts (Bucket only)

### Where Failure Propagation Occurs
1. **Sarathi down** → Core BLOCKS (`core/app.js:45-55`)
2. **Invalid token** → Bridge BLOCKS (`bridge/app.js:28-45`)
3. **Execution down** → Bridge FAILS (`bridge/app.js:82-95`)
4. **Bucket failure** → Execution FAILS (`execution/app.js:87-105`)

### How Zero-Trust Boundaries Are Enforced

**JWT Enforcement** (`bridge/app.js:28-45`):
- External authority only (Sarathi)
- Validates issuer: `tantra-sarathi`
- Validates expiry via `jwt.verify`
- Validates signature using Sarathi's public key
- Rejects tampered tokens (signature check)
- Rejects replay tokens (expiry + unique claims)

**No Local Signing** (`sarathi/app.js:8-22`):
- Only Sarathi has private key
- Bridge fetches public key from Sarathi
- No other service can sign tokens

**External Execution** (`execution/app.js:1-120`):
- Bridge CANNOT execute workloads internally
- Execution Service validates bridge signature
- Returns structured response to Bridge

**Bucket Verification** (`bucket/app.js:45-95`):
- Mandatory read-after-write
- Verify artifact exists (`artifacts.get(location)`)
- Verify hash matches (SHA-256 comparison)
- Verify schema validity (required fields check)

**Immutable Trace** (`bridge/app.js:45-60`, `execution/app.js:45-55`):
- Same trace_id across all services
- Same execution_id across all services
- Mutation returns 400 Bad Request
- No service can change these IDs

## Failure Tests Status

| Test | Status | Notes |
|------|--------|-------|
| Sarathi down → BLOCK | ✅ Implemented | Returns 503 |
| Invalid token → BLOCK | ✅ Implemented | Returns 401 |
| Tampered token → BLOCK | ✅ Implemented | Signature fails |
| Replay token → BLOCK | ✅ Implemented | JWT expiry |
| Execution down → FAIL | ✅ Implemented | Returns 503 |
| Bucket failure → FAIL | ✅ Implemented | Returns 500 |

See `FAILURE_TESTS.md` for detailed test procedures.

## Startup Instructions

### Option 1: Docker Compose (Recommended)
```bash
cd services
docker-compose up -d
docker-compose logs -f
```

### Option 2: Manual Start (Windows)
```bash
cd services\core
copy .env.example .env
start start.bat

cd ..\sarathi
copy .env.example .env
start start.bat

cd ..\bridge
copy .env.example .env
start start.bat

cd ..\execution
copy .env.example .env
start start.bat

cd ..\bucket
copy .env.example .env
start start.bat
```

### Option 3: Manual Start (Linux/Mac)
```bash
cd services/core && cp .env.example .env && ./start.sh &
cd services/sarathi && cp .env.example .env && ./start.sh &
cd services/bridge && cp .env.example .env && ./start.sh &
cd services/execution && cp .env.example .env && ./start.sh &
cd services/bucket && cp .env.example .env && ./start.sh &
```

## Verification

### Health Check All Services
```bash
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
```

### Full Workflow Test
```bash
curl -X POST http://localhost:3000/initiate \
  -H "Content-Type: application/json" \
  -d '{"workload": "test-task"}'
```

## Evidence Locations
- Logs: `docker-compose logs` output
- Screenshots: (User to capture)
- Proofs: Run FAILURE_TESTS.md procedures
- Phase 2 Proofs: `../scripts/master_verification.sh`
- Bucket DB: `bucket/bucket.db` (SQLite)
- Terminal output: Run `../scripts/demo_flow.sh`

## Architecture Decisions

1. **RS256 over HS256**: Public/private key separation enforces external authority
2. **No service mesh**: Direct HTTP calls for simplicity, add mTLS for production
3. **Read-after-write verification**: Ensures storage integrity
4. **Immutable IDs**: UUIDs generated once, never mutated
5. **No retries**: Fail fast, let caller handle retry with backoff

## Production Recommendations

1. Add mTLS between services
2. Use proper secret management (Vault, AWS Secrets Manager)
3. Replace in-memory storage with database
4. Add Prometheus metrics endpoint
5. Implement distributed tracing (Jaeger, Zipkin)
6. Add rate limiting and circuit breakers (but NO fallback execution)
