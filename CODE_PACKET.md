# TANTRA Gated Bridge — Code Packet

**Version**: 1.0.0
**Date**: 2026-07-09
**Purpose**: Reviewer navigation guide for the TANTRA Gated Bridge codebase

---

## Quick Navigation

### Core Service Chain (5 services, the main pipeline)

| Step | Service | File | Lines | What It Does |
|------|---------|------|-------|--------------|
| 1 | Core | `services/core/app.js` | 115 | Entry point. Generates trace_id + execution_id UUIDs, requests JWT from Sarathi, forwards to Bridge |
| 2 | Sarathi | `services/sarathi/app.js` | 172 | JWT authority. Issues RS256/EdDSA tokens with jti, trace_id, execution_id, cet_hash claims |
| 3 | Bridge | `services/bridge/app.js` | 275 | Passive forwarder. Validates JWT via JWKS (kid resolution), enforces immutable IDs, rejects replay, forwards to Execution |
| 4 | Execution | `services/execution/app.js` | 242 | Workload executor. Verifies bridge signature, runs participant, stores artifact in Bucket |
| 5 | Bucket | `services/bucket/app.js` | 202 | Artifact storage. SQLite with read-after-write verification + SHA-256 hash |

### Supporting Modules

| Module | Directory | Files | Purpose |
|--------|-----------|-------|---------|
| Replay Persistence | `services/replay_persistence/` | `jti_store.js`, `append_only_store.js`, `lineage_tracker.js`, `continuity_recorder.js`, `idempotency_store.js` | Append-only SHA-256 hash chain for replay detection |
| Replay Reconstruction | `services/replay_reconstruction/` | `reconstruction_tool.js`, `verification_flow.js`, `corruption_detector.js`, `lineage_graph.js` | Trace reconstruction and chain integrity verification |
| Observability | `services/observability/` | `telemetry_emitter.js`, `trace_collector.js`, `replay_hooks.js` | Passive telemetry emission, wired into Bridge + Execution |
| InsightFlow | `services/insightflow/` | `adapter.js`, `local_receiver.js`, `readiness_check.js` | Telemetry receiver on port 3005 |

### Key Persistence

| File | Location | Purpose |
|------|----------|---------|
| `key_persistence.js` | `services/sarathi/` | RSA + Ed25519 key generation, loading, rotation |

---

## Architecture Walkthrough

### 1. Request Flow

```
Client → Core(:3000) → Sarathi(:3001) → Bridge(:3002) → Execution(:3003) → Bucket(:3004)
```

**Core** (`services/core/app.js`):
- Line 29: `crypto.randomUUID()` generates trace_id and execution_id
- Line 31: cet_hash = SHA-256(trace_id:execution_id)
- Line 38: POST to Sarathi /token with {trace_id, execution_id, cet_hash}
- Line 49: POST to Bridge /execute with JWT Bearer token

**Sarathi** (`services/sarathi/app.js`):
- Line 6: `keyPersistence.loadOrGenerateKeys()` loads or creates RSA + Ed25519 key pairs
- Line 35-41: RSA and Ed25519 private keys loaded, KIDs extracted from metadata
- Line 80-130: /token endpoint issues JWT with kid header, RS256 or EdDSA
- Line 133-170: /.well-known/jwks.json serves public keys in JWKS format

**Bridge** (`services/bridge/app.js`):
- Line 33-55: fetchJwks() fetches JWKS from Sarathi with caching (TTL)
- Line 57-66: resolveJwk() selects key by kid from JWKS
- Line 72-92: verifyEdDSAToken() verifies EdDSA signatures manually
- Line 94-153: validateToken middleware — JWT verification, replay detection
- Line 155-210: enforceContinuity middleware — trace_id/execution_id/cet_hash immutability
- Line 212-240: POST /execute — passive forwarding to Execution

**Execution** (`services/execution/app.js`):
- Line 31-50: fetchJwks() from Sarathi
- Line 130-170: validateBridgeToken — verifies bridge signature
- Line 185-220: POST /run — executes workload, stores in Bucket

**Bucket** (`services/bucket/app.js`):
- Line 10: SQLite database initialization
- Line 46-95: POST /store — stores artifact with read-after-write verification

### 2. Security Enforcement Points

| Check | Location | Line | Action |
|-------|----------|------|--------|
| JWT signature | `bridge/app.js` | 119-125 | jwt.verify() with RS256 or EdDSA |
| JWKS kid resolution | `bridge/app.js` | 57-66 | resolveJwk() matches kid from JWT header |
| Replay detection | `bridge/app.js` | 136-140 | jtiStore.hasJti() checks append-only log |
| trace_id immutability | `bridge/app.js` | 167-171 | Body trace_id must match token |
| execution_id immutability | `bridge/app.js` | 179-183 | Body execution_id must match token |
| cet_hash enforcement | `bridge/app.js` | 191-210 | Body + header cet_hash must match token |
| Issuer validation | `bridge/app.js` | 86,123 | issuer must be "tantra-sarathi" |
| Audience validation | `bridge/app.js` | 87,124 | audience must be "tantra-bridge" |

### 3. Persistence Layer

**Replay Log** (`services/replay_persistence/data/replay_log.jsonl`):
- Each line is a JSON record: {trace_id, execution_id, jti, timestamp, hash, previous_hash}
- SHA-256 hash chain: each record's hash = SHA-256(data + previous_hash)
- Validated via `append_only_store.js:validateChainIntegrity()`

**Key Files** (`services/sarathi/keys/`):
- `private.pem` — RSA 2048-bit private key
- `public.pem` — RSA 2048-bit public key
- `ed25519_private.pem` — Ed25519 private key
- `ed25519_public.pem` — Ed25519 public key
- `key_meta.json` — KIDs, rotation count, algorithm metadata

**Bucket Database** (`services/bucket/bucket.db`):
- SQLite `artifacts` table with read-after-write verification
- Schema: location, trace_id, execution_id, result, timestamp, duration_ms, stored_at, hash

---

## Test Files

| Test | Location | What It Tests |
|------|----------|---------------|
| Survivability Suite | `services/survivability_tests/test_suite.js` | 7 scenarios: restart recovery, chain integrity, corruption detection, concurrency |
| Bridge Convergence | `services/bridge/tests/convergence_test.js` | 12 tests: EdDSA, RS256, replay, immutability, JWKS kid resolution |
| Platform Tests | `tests/platform_tests/` | 76 pytest tests: Configuration, Environment, Service Registry, Worker Manager |

---

## Configuration

| File | Location | Purpose |
|------|----------|---------|
| `.env` | `services/core/` | PORT=3000, SARATHI_URL, BRIDGE_URL |
| `.env` | `services/sarathi/` | PORT=3001, ISSUER, JWT_EXPIRY |
| `.env` | `services/bridge/` | PORT=3002, SARATHI_URL, EXECUTION_URL |
| `.env` | `services/execution/` | PORT=3003, SARATHI_URL, BUCKET_URL |
| `.env` | `services/bucket/` | PORT=3004 |
| `.env.example` | `tantra_gated_bridge/configs/` | Global template |

---

## Deployment

| Config | Location | Description |
|--------|----------|-------------|
| `docker-compose.yml` | `services/` | Canonical 6-service stack on tantra-network |
| `docker-compose.yml` | `tantra_gated_bridge/deployment/` | Production compose with env vars and volumes |
| `Dockerfile` | `services/*/` | One per service (node:18-alpine) |
| `start.ps1` | `scripts/` | Single-command native startup |
| `verify.ps1` | `scripts/` | Single-command health verification |
| `convergence_proof.ps1` | `scripts/` | Full convergence proof |

---

## Repository Layout

```
TANTRA-Gated-Bridge-Infrastructure/
├── services/                          # CANONICAL source code
│   ├── core/                          # Entry point (115 lines)
│   ├── sarathi/                       # JWT authority (172 lines)
│   ├── bridge/                        # Passive forwarder (275 lines)
│   ├── execution/                     # Workload executor (242 lines)
│   ├── bucket/                        # SQLite storage (202 lines)
│   ├── insightflow/                   # Telemetry receiver
│   ├── observability/                 # Telemetry + trace
│   ├── replay_persistence/            # Append-only SHA-256 chain
│   ├── replay_reconstruction/         # Trace reconstruction
│   ├── survivability_tests/           # 7 survivability scenarios
│   ├── bridge/tests/                  # 12 convergence tests
│   └── review_packets/               # Historical review packets
│
├── docs/                              # Documentation suite (9 documents)
├── scripts/                           # Startup/stop/verify scripts
├── tests/                             # Integration + platform tests
│   ├── platform_tests/               # 76 pytest tests
│   ├── replay_test.sh                # Replay protection test
│   ├── trace_integrity_test.sh       # ID immutability test
│   └── bucket_persistence_test.sh    # SQLite persistence test
├── config/                            # YAML configuration
├── deployment/                        # Deployment scripts
├── tantra_gated_bridge/               # Docker configs + frozen snapshot
│   ├── deployment/                   # docker-compose.yml
│   ├── scripts/                      # Startup/stop/verify
│   ├── services/                     # Frozen snapshot (reference)
│   ├── docs/                         # Additional docs
│   └── review_packets/               # Historical review packets
│
├── REVIEW_PACKET.md                   # THIS DOCUMENT (canonical)
├── CODE_PACKET.md                     # THIS DOCUMENT (reviewer guide)
├── FINAL_HANDOVER_PACKET.md           # Complete handover
├── FINAL_SUBMISSION_STATUS.md         # Acceptance status
├── README.md                          # Project overview
└── .gitignore                         # Excludes node_modules, .env, keys, data
```
