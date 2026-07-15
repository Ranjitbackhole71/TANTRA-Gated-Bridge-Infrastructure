# TANTRA Architecture Diagram

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              TANTRA SYSTEM ARCHITECTURE                                      │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            USER LAYER                                                   │ │
│  │                                                                                         │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                              USER                                                │    │ │
│  │  │  - Sends workload request                                                       │    │ │
│  │  │  - Receives final response                                                      │    │ │
│  │  │  - Can verify trace_id, execution_id                                           │    │ │
│  │  │  - Can retrieve artifacts                                                       │    │ │
│  │  │  - Can query telemetry                                                          │    │ │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘    │ │
│  │                                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            USER-FACING PRODUCT LAYER                                    │ │
│  │                                                                                         │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                              SETU (:8000)                                        │    │ │
│  │  │  - FastAPI application                                                          │    │ │
│  │  │  - User-facing product                                                          │    │ │
│  │  │  - Routes requests through TANTRA runtime                                       │    │ │
│  │  │  - Returns complete response with trace_id, execution_id                        │    │ │
│  │  │  - Provides artifact retrieval endpoint                                         │    │ │
│  │  │  - Provides telemetry query endpoint                                            │    │ │
│  │  │                                                                                 │    │ │
│  │  │  Endpoints:                                                                     │    │ │
│  │  │    POST /process - Process user request                                         │    │ │
│  │  │    GET /health - Health check                                                   │    │ │
│  │  │    GET /artifact/{trace_id}/{execution_id} - Retrieve artifact                  │    │ │
│  │  │    GET /telemetry/{trace_id} - Query InsightFlow telemetry                      │    │ │
│  │  │    GET /telemetry - Telemetry summary                                           │    │ │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘    │ │
│  │                                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            TANTRA RUNTIME LAYER                                        │ │
│  │                                                                                         │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                              CORE (:3000)                                        │    │ │
│  │  │  - Entry point for workflows                                                     │    │ │
│  │  │  - Generates trace_id + execution_id + cet_hash                                 │    │ │
│  │  │  - Requests JWT from Sarathi                                                    │    │ │
│  │  │  - Forwards to Bridge with JWT                                                  │    │ │
│  │  │  - Returns response to Setu                                                     │    │ │
│  │  │                                                                                 │    │ │
│  │  │  Responsibilities:                                                              │    │ │
│  │  │    - trace_id generation (UUID)                                                 │    │ │
│  │  │    - execution_id generation (UUID)                                             │    │ │
│  │  │    - cet_hash computation (SHA-256)                                             │    │ │
│  │  │    - Workflow orchestration                                                      │    │ │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘    │ │
│  │                                                                                         │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                              SARATHI (:3001)                                     │    │ │
│  │  │  - JWT authority (RS256 + EdDSA)                                                 │    │ │
│  │  │  - Sole token issuer in the system                                              │    │ │
│  │  │  - Issues JWTs with trace_id, execution_id, cet_hash claims                     │    │ │
│  │  │  - Serves JWKS endpoint for public key verification                             │    │ │
│  │  │  - Manages key persistence (RSA + Ed25519)                                      │    │ │
│  │  │                                                                                 │    │ │
│  │  │  Responsibilities:                                                              │    │ │
│  │  │    - Token generation (RS256 or EdDSA)                                          │    │ │
│  │  │    - Key management (load/generate/rotate)                                       │    │ │
│  │  │    - JWKS serving                                                               │    │ │
│  │  │                                                                                 │    │ │
│  │  │  FORBIDDEN:                                                                     │    │ │
│  │  │    - Cannot execute workloads                                                   │    │ │
│  │  │    - Cannot store artifacts                                                     │    │ │
│  │  │    - Cannot forward requests                                                    │    │ │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘    │ │
│  │                                                                                         │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                              BRIDGE (:3002)                                      │    │ │
│  │  │  - PASSIVE FORWARDER ONLY                                                        │    │ │
│  │  │  - Validates JWT from Sarathi                                                    │    │ │
│  │  │  - Enforces immutable IDs (trace_id, execution_id, cet_hash)                     │    │ │
│  │  │  - Detects replay attacks (jti uniqueness)                                       │    │ │
│  │  │  - Forwards to Execution Service                                                │    │ │
│  │  │                                                                                 │    │ │
│  │  │  Responsibilities:                                                              │    │ │
│  │  │    - JWT validation (RS256/EdDSA)                                               │    │ │
│  │  │    - ID immutability enforcement                                                │    │ │
│  │  │    - Replay detection                                                           │    │ │
│  │  │    - Request forwarding                                                         │    │ │
│  │  │                                                                                 │    │ │
│  │  │  FORBIDDEN:                                                                     │    │ │
│  │  │    - Cannot generate tokens (Sarathi only)                                      │    │ │
│  │  │    - Cannot execute workloads (Execution only)                                  │    │ │
│  │  │    - Cannot store artifacts (Bucket only)                                       │    │ │
│  │  │    - Cannot create fallback paths                                               │    │ │
│  │  │                                                                                 │    │ │
│  │  │  Security:                                                                      │    │ │
│  │  │    - Fetches JWKS from Sarathi with caching                                     │    │ │
│  │  │    - Validates issuer: tantra-sarathi                                           │    │ │
│  │  │    - Validates audience: tantra-bridge                                          │    │ │
│  │  │    - Rejects tampered tokens                                                    │    │ │
│  │  │    - Records jti in replay store                                                │    │ │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘    │ │
│  │                                                                                         │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                              EXECUTION (:3003)                                   │    │ │
│  │  │  - Workload executor                                                            │    │ │
│  │  │  - Validates bridge signature (JWT from Sarathi)                                 │    │ │
│  │  │  - Executes workload via execution_participant.js                                │    │ │
│  │  │  - Stores artifact in Bucket                                                    │    │ │
│  │  │                                                                                 │    │ │
│  │  │  Responsibilities:                                                              │    │ │
│  │  │    - Bridge signature validation                                                │    │ │
│  │  │    - ID immutability enforcement                                                │    │ │
│  │  │    - Workload execution                                                         │    │ │
│  │  │    - Artifact storage                                                           │    │ │
│  │  │                                                                                 │    │ │
│  │  │  FORBIDDEN:                                                                     │    │ │
│  │  │    - Cannot generate tokens                                                     │    │ │
│  │  │    - Cannot validate JWTs directly (uses bridge signature)                      │    │ │
│  │  │    - Cannot create fallback paths                                               │    │ │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘    │ │
│  │                                                                                         │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                              BUCKET (:3004)                                      │    │ │
│  │  │  - Artifact storage (SQLite)                                                    │    │ │
│  │  │  - Read-after-write verification                                                │    │ │
│  │  │  - SHA-256 hash verification                                                    │    │ │
│  │  │  - Schema validation                                                            │    │ │
│  │  │                                                                                 │    │ │
│  │  │  Responsibilities:                                                              │    │ │
│  │  │    - Artifact storage                                                           │    │ │
│  │  │    - Hash generation                                                            │    │ │
│  │  │    - Read-after-write verification                                              │    │ │
│  │  │    - Artifact retrieval                                                         │    │ │
│  │  │                                                                                 │    │ │
│  │  │  FORBIDDEN:                                                                     │    │ │
│  │  │    - Cannot generate tokens                                                     │    │ │
│  │  │    - Cannot execute workloads                                                   │    │ │
│  │  │    - Cannot forward requests                                                    │    │ │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘    │ │
│  │                                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            OBSERVABILITY LAYER                                          │ │
│  │                                                                                         │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                              INSIGHTFLOW (:3005)                                 │    │ │
│  │  │  - Telemetry receiver                                                           │    │ │
│  │  │  - Receives events from Bridge and Execution                                    │    │ │
│  │  │  - Passive telemetry ingestion                                                  │    │ │
│  │  │  - Stores events in JSONL file                                                  │    │ │
│  │  │                                                                                 │    │ │
│  │  │  Event Types:                                                                   │    │ │
│  │  │    - execution_transition (state changes)                                       │    │ │
│  │  │    - rejection (token/ID validation failure)                                    │    │ │
│  │  │    - dependency_failure (service unavailable)                                   │    │ │
│  │  │    - replay_verification (replay check result)                                  │    │ │
│  │  │                                                                                 │    │ │
│  │  │  NOTE: Telemetry is a side-effect, not part of the synchronous response path.  │    │ │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘    │ │
│  │                                                                                         │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                              REPLAY PERSISTENCE                                  │    │ │
│  │  │  - Append-only JSONL store                                                      │    │ │
│  │  │  - SHA-256 hash chain                                                           │    │ │
│  │  │  - JTI uniqueness tracking                                                      │    │ │
│  │  │  - Restart-safe storage                                                         │    │ │
│  │  │                                                                                 │    │ │
│  │  │  Components:                                                                    │    │ │
│  │  │    - append_only_store.js                                                       │    │ │
│  │  │    - lineage_tracker.js                                                         │    │ │
│  │  │    - continuity_recorder.js                                                     │    │ │
│  │  │    - idempotency_store.js                                                       │    │ │
│  │  │                                                                                 │    │ │
│  │  │  Storage: services/replay_persistence/data/replay_log.jsonl                     │    │ │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘    │ │
│  │                                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Service Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              SERVICE DEPENDENCIES                                            │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  Setu (:8000)                                                                               │
│    ├── Core (:3000)                                                                         │
│    ├── Bucket (:3004) - artifact retrieval                                                  │
│    └── InsightFlow (:3005) - telemetry query                                                │
│                                                                                             │
│  Core (:3000)                                                                                │
│    ├── Sarathi (:3001) - JWT generation                                                     │
│    └── Bridge (:3002) - request forwarding                                                  │
│                                                                                             │
│  Sarathi (:3001)                                                                             │
│    └── (no dependencies - key persistence only)                                             │
│                                                                                             │
│  Bridge (:3002)                                                                              │
│    ├── Sarathi (:3001) - JWKS endpoint                                                      │
│    ├── Execution (:3003) - request forwarding                                               │
│    ├── Replay Persistence - jti tracking                                                    │
│    └── InsightFlow (:3005) - telemetry emission                                             │
│                                                                                             │
│  Execution (:3003)                                                                           │
│    ├── Sarathi (:3001) - JWKS endpoint                                                      │
│    ├── Bucket (:3004) - artifact storage                                                    │
│    ├── Replay Persistence - telemetry recording                                             │
│    └── InsightFlow (:3005) - telemetry emission                                             │
│                                                                                             │
│  Bucket (:3004)                                                                              │
│    └── (no dependencies - SQLite only)                                                      │
│                                                                                             │
│  InsightFlow (:3005)                                                                         │
│    └── (no dependencies - file storage only)                                                │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Port Allocation

| Service | Port | Protocol | Description |
|---------|------|----------|-------------|
| Setu | 8000 | HTTP | User-facing product |
| Core | 3000 | HTTP | Workflow orchestration |
| Sarathi | 3001 | HTTP | JWT authority |
| Bridge | 3002 | HTTP | Passive forwarder |
| Execution | 3003 | HTTP | Workload executor |
| Bucket | 3004 | HTTP | Artifact storage |
| InsightFlow | 3005 | HTTP | Telemetry receiver |

## API Contracts

### Setu API

| Endpoint | Method | Request | Response |
|----------|--------|---------|----------|
| `/process` | POST | `{workload, metadata?}` | `ProcessResponse` |
| `/health` | GET | - | `HealthResponse` |
| `/artifact/{trace_id}/{execution_id}` | GET | - | `ArtifactResponse` |
| `/telemetry/{trace_id}` | GET | - | Telemetry events |
| `/telemetry` | GET | - | Telemetry summary |
| `/` | GET | - | API information |

### Core API

| Endpoint | Method | Request | Response |
|----------|--------|---------|----------|
| `/initiate` | POST | `{workload, source?, setu_request_id?, user_metadata?}` | `{trace_id, execution_id, cet_hash, status, result}` |
| `/health` | GET | - | `{service, status}` |

### Sarathi API

| Endpoint | Method | Request | Response |
|----------|--------|---------|----------|
| `/token` | POST | `{trace_id, execution_id, cet_hash, algorithm?}` | `{token, trace_id, execution_id, jti, algorithm}` |
| `/public-key` | GET | - | `{public_key}` |
| `/jwks` | GET | - | `{keys}` |
| `/.well-known/jwks.json` | GET | - | `{keys}` |
| `/health` | GET | - | `{service, status, issuer, algorithms}` |

### Bridge API

| Endpoint | Method | Request | Response |
|----------|--------|---------|----------|
| `/execute` | POST | `{workload, trace_id, execution_id, cet_hash}` | Execution response |
| `/health` | GET | - | `{service, status, algorithms}` |

### Execution API

| Endpoint | Method | Request | Response |
|----------|--------|---------|----------|
| `/run` | POST | `{workload, trace_id, execution_id, bridge_signature}` | `{trace_id, execution_id, status, result, artifact_location, duration_ms}` |
| `/health` | GET | - | `{service, status, algorithms}` |

### Bucket API

| Endpoint | Method | Request | Response |
|----------|--------|---------|----------|
| `/store` | POST | `{trace_id, execution_id, result, timestamp, duration_ms}` | `{location, trace_id, execution_id, hash, verified, persistent}` |
| `/retrieve/{trace_id}/{execution_id}` | GET | - | `{trace_id, execution_id, result, timestamp, duration_ms, stored_at, hash}` |
| `/health` | GET | - | `{service, status}` |

### InsightFlow API

| Endpoint | Method | Request | Response |
|----------|--------|---------|----------|
| `/api/v1/telemetry` | POST | Telemetry payload | `{received, timestamp}` |
| `/telemetry` | GET | `?trace_id=&limit=` | `{trace_id, count, total, events}` |
| `/telemetry/{traceId}` | GET | - | `{trace_id, count, events}` |
| `/telemetry/summary` | GET | - | `{total_events, unique_traces, traces}` |
| `/health` | GET | - | `{service, status, port}` |

## Security Architecture

### Zero-Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              ZERO-TRUST BOUNDARIES                                           │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  1. No Local Signing                                                                        │
│     - Bridge cannot sign tokens                                                             │
│     - Only Sarathi can generate JWTs                                                        │
│     - All services verify JWTs via Sarathi's public key                                     │
│                                                                                             │
│  2. No Local Execution                                                                      │
│     - Bridge cannot execute workloads                                                       │
│     - Only Execution can run workloads                                                      │
│     - Bridge is a passive forwarder only                                                    │
│                                                                                             │
│  3. No Fallback Paths                                                                       │
│     - All failures stop the system immediately                                              │
│     - No degraded mode                                                                      │
│     - No retry-based bypass                                                                 │
│                                                                                             │
│  4. Immutable IDs                                                                           │
│     - trace_id cannot be mutated                                                            │
│     - execution_id cannot be mutated                                                        │
│     - cet_hash cannot be mutated                                                            │
│     - Mutation returns 400 Bad Request                                                      │
│                                                                                             │
│  5. External Verification                                                                   │
│     - All services verify JWTs via Sarathi's public key                                     │
│     - No implicit trust between services                                                    │
│     - Every hop is validated                                                                │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### JWT Validation Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              JWT VALIDATION FLOW                                             │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  1. Token Receipt                                                                           │
│     - Bridge receives JWT in Authorization header                                           │
│     - Execution receives JWT in bridge_signature field                                      │
│                                                                                             │
│  2. Header Decoding                                                                         │
│     - Decode JWT header to extract kid and alg                                              │
│                                                                                             │
│  3. JWKS Fetch                                                                              │
│     - Fetch JWKS from Sarathi (with caching)                                                │
│     - Resolve key by kid                                                                    │
│                                                                                             │
│  4. Signature Verification                                                                  │
│     - RS256: jwt.verify() with RSA public key                                               │
│     - EdDSA: Manual Ed25519 signature verification                                         │
│                                                                                             │
│  5. Claims Validation                                                                       │
│     - Issuer: tantra-sarathi                                                                │
│     - Audience: tantra-bridge                                                               │
│     - Expiry: token not expired                                                             │
│     - jti: unique (replay detection)                                                        │
│                                                                                             │
│  6. ID Immutability                                                                         │
│     - Body trace_id == Token trace_id                                                       │
│     - Body execution_id == Token execution_id                                               │
│     - Body cet_hash == Token cet_hash                                                       │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Data Persistence

### Storage Locations

| Service | Storage | Location | Purpose |
|---------|---------|----------|---------|
| Bucket | SQLite | `services/bucket/bucket.db` | Artifact storage |
| Sarathi | File | `services/sarathi/keys/` | RSA + Ed25519 keys |
| Replay Persistence | JSONL | `services/replay_persistence/data/replay_log.jsonl` | Append-only log |
| InsightFlow | JSONL | `services/insightflow/data/insightflow_telemetry.jsonl` | Telemetry events |

### Data Schemas

#### Bucket Artifacts

```sql
CREATE TABLE artifacts (
    location TEXT PRIMARY KEY,
    trace_id TEXT NOT NULL,
    execution_id TEXT NOT NULL,
    result TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    duration_ms INTEGER,
    stored_at TEXT NOT NULL,
    hash TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

#### Replay Log

```json
{
    "timestamp": "ISO-8601",
    "trace_id": "uuid",
    "execution_id": "uuid",
    "event_type": "string",
    "service": "string",
    "status": "string",
    "payload": {},
    "hash": "sha256-hex",
    "previous_hash": "sha256-hex"
}
```

#### InsightFlow Telemetry

```json
{
    "source": "tantra-bridge",
    "trace_id": "uuid",
    "execution_id": "uuid",
    "event_type": "string",
    "status": "string",
    "payload": {
        "passive": true,
        ...
    },
    "timestamp": "ISO-8601",
    "received_at": "ISO-8601"
}
```
