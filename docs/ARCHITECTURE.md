# TANTRA Architecture

## System Overview

TANTRA is a zero-trust, hard-fail distributed infrastructure pipeline for secure workload execution.

## Topology

```
                         ┌─────────────────┐
                         │   Gateway (:8000)│  (Python/FastAPI)
                         │   Platform Mgmt  │
                         └────────┬────────┘
                                  │
    ┌─────────────────────────────┼─────────────────────────────┐
    │                             │                             │
    ▼                             ▼                             ▼
┌─────────┐  JWT   ┌──────────┐  JWT+JWKS  ┌──────────┐  JWT+JWKS  ┌──────────┐
│  Core   │───────▶│ Sarathi  │───────────▶│  Bridge  │───────────▶│Execution │
│ (:3000) │        │ (:3001)  │            │ (:3002)  │            │ (:3003)  │
└─────────┘        └──────────┘            └──────────┘            └────┬─────┘
     │                                                                  │
     │ POST /initiate                                                   │
     │                                                                  │ POST /store
     │                                                                  ▼
     │                                                          ┌──────────┐
     │                                                          │  Bucket  │
     │                                                          │ (:3004)  │
     │                                                          └──────────┘
     │                                                                │
     └────────────────────────────────────────────────────────────────┘
                              Response Chain
```

## Service Responsibilities

### Core (:3000)
- **Role**: Workflow initiator
- **Responsibilities**: Generates trace_id, execution_id, cet_hash; requests JWT from Sarathi; forwards to Bridge with Authorization + X-Sarathi headers
- **Language**: Node.js (Express)

### Sarathi (:3001)
- **Role**: JWT Authority
- **Responsibilities**: Issues JWT tokens (RS256 + EdDSA); serves JWKS endpoint; manages key persistence and rotation
- **Language**: Node.js (Express)
- **Key Features**: Dual-algorithm support, key rotation, JWKS discovery

### Bridge (:3002)
- **Role**: Passive forwarding with validation
- **Responsibilities**: Validates JWT via JWKS (kid resolution); enforces cet_hash/trace_id/execution_id continuity (body + headers); detects replay attacks (jti); forwards to Execution
- **Language**: Node.js (Express)
- **Security**: Zero-trust, no fallback, no local token minting

### Execution (:3003)
- **Role**: Workload execution
- **Responsibilities**: Validates bridge signature via JWKS; enforces ID immutability; runs workload via EXECUTION_PARTICIPANT adapter; stores artifact in Bucket
- **Language**: Node.js (Express)
- **Adapter Pattern**: Pluggable execution via EXECUTION_PARTICIPANT env var

### Bucket (:3004)
- **Role**: Persistent artifact storage
- **Responsibilities**: SQLite-backed storage; read-after-write verification; SHA-256 hash verification
- **Language**: Node.js (Express)

### InsightFlow (:3005) [Optional]
- **Role**: Telemetry receiver
- **Responsibilities**: Receives and stores telemetry events; provides query API
- **Language**: Node.js (Express)

## Security Model

### Zero-Trust Principles
1. **Every service validates JWTs** — no implicit trust
2. **No fallback paths** — any dependency failure stops the system
3. **No local token minting** — Bridge never generates tokens
4. **Immutable IDs** — trace_id/execution_id enforced across all services
5. **Replay protection** — jti claim prevents token reuse

### JWT Validation Flow
```
1. Core requests token from Sarathi (with trace_id, execution_id, cet_hash)
2. Sarathi signs JWT with RS256 or EdDSA
3. Core forwards to Bridge with Authorization header + X-Sarathi headers
4. Bridge validates JWT via JWKS (kid resolution)
5. Bridge checks jti against replay store
6. Bridge enforces cet_hash/trace_id/execution_id continuity
7. Bridge forwards to Execution with bridge_signature header
8. Execution validates bridge signature via JWKS
9. Execution enforces ID immutability
```

### Replay Protection
- **Mechanism**: jti (JWT ID) claim uniqueness
- **Storage**: Append-only JSONL file with SHA-256 hash chain
- **Persistence**: Survives restart via file-based storage
- **TTL**: 1 hour (configurable via REPLAY_TTL_MS)

## Data Flow

### Request Path
```
Client → Core → Sarathi (token) → Bridge → Execution → Bucket
```

### Response Path
```
Bucket → Execution → Bridge → Core → Client
```

### Telemetry Path
```
Bridge → observability/replay_hooks → telemetry_emitter → append_only_store (JSONL)
Execution → observability/replay_hooks → telemetry_emitter → append_only_store (JSONL)
[Optional] → InsightFlow adapter → InsightFlow receiver
```

## Persistence

### Replay Log
- **Location**: `services/replay_persistence/data/replay_log.jsonl`
- **Format**: Append-only JSONL with SHA-256 hash chain
- **Records**: Token usage, execution transitions, rejections, dependency failures

### Key Storage
- **Location**: `services/sarathi/keys/`
- **Files**: `private.pem`, `public.pem`, `ed25519_private.pem`, `ed25519_public.pem`, `key_meta.json`
- **Rotation**: Supported via `rotateKeys()` function

### Artifact Storage
- **Location**: SQLite database (`bucket.db`)
- **Schema**: artifacts table with hash verification

## Technology Stack

| Component | Technology |
|-----------|------------|
| Core Services | Node.js 18, Express.js |
| Gateway | Python 3.11, FastAPI, Uvicorn |
| JWT | jsonwebtoken (RS256), custom EdDSA |
| Storage | SQLite (better-sqlite3), JSONL files |
| Deployment | Docker, Docker Compose |
| Testing | Shell scripts, Node.js tests |
