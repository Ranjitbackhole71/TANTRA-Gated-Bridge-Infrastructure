# TANTRA Integration Diagram

## Service Integration Map

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              SERVICE INTEGRATION MAP                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                              SETU (:8000)                                               │ │
│  │                                                                                         │ │
│  │  Integration Points:                                                                   │ │
│  │    ├── Core (:3000)                                                                    │ │
│  │    │   └── POST /initiate                                                              │ │
│  │    │       └── Request: {workload, source, setu_request_id, user_metadata}             │ │
│  │    │       └── Response: {trace_id, execution_id, cet_hash, status, result}            │ │
│  │    │                                                                                   │ │
│  │    ├── Bucket (:3004)                                                                  │ │
│  │    │   └── GET /retrieve/{trace_id}/{execution_id}                                     │ │
│  │    │       └── Response: {trace_id, execution_id, result, timestamp, hash}             │ │
│  │    │                                                                                   │ │
│  │    └── InsightFlow (:3005)                                                             │ │
│  │        └── GET /telemetry/{trace_id}                                                   │ │
│  │        └── GET /telemetry/summary                                                      │ │
│  │                                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                              CORE (:3000)                                               │ │
│  │                                                                                         │ │
│  │  Integration Points:                                                                   │ │
│  │    ├── Sarathi (:3001)                                                                 │ │
│  │    │   └── POST /token                                                                 │ │
│  │    │       └── Request: {trace_id, execution_id, cet_hash}                             │ │
│  │    │       └── Response: {token, trace_id, execution_id, jti, algorithm}               │ │
│  │    │                                                                                   │ │
│  │    └── Bridge (:3002)                                                                  │ │
│  │        └── POST /execute                                                               │ │
│  │            └── Headers: Authorization: Bearer <jwt>                                    │ │
│  │            └── Headers: X-Sarathi-Trace-Id, X-Sarathi-Execution-Id, X-Sarathi-Cet-Hash│ │
│  │            └── Body: {workload, trace_id, execution_id, cet_hash}                      │ │
│  │            └── Response: Execution response data                                       │ │
│  │                                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                              SARATHI (:3001)                                            │ │
│  │                                                                                         │ │
│  │  Integration Points:                                                                   │ │
│  │    └── (No outgoing integrations - key persistence only)                               │ │
│  │                                                                                         │ │
│  │  Provides:                                                                             │ │
│  │    ├── POST /token - JWT generation                                                    │ │
│  │    ├── GET /public-key - RSA public key                                                │ │
│  │    ├── GET /jwks - JWKS endpoint                                                       │ │
│  │    └── GET /.well-known/jwks.json - Standard JWKS endpoint                             │ │
│  │                                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                              BRIDGE (:3002)                                             │ │
│  │                                                                                         │ │
│  │  Integration Points:                                                                   │ │
│  │    ├── Sarathi (:3001)                                                                 │ │
│  │    │   └── GET /.well-known/jwks.json                                                  │ │
│  │    │       └── Response: {keys: [{kid, alg, kty, ...}]}                                │ │
│  │    │                                                                                   │ │
│  │    ├── Execution (:3003)                                                               │ │
│  │    │   └── POST /run                                                                   │ │
│  │    │       └── Body: {workload, trace_id, execution_id, bridge_signature}              │ │
│  │    │       └── Response: {trace_id, execution_id, status, result, artifact_location}   │ │
│  │    │                                                                                   │ │
│  │    ├── Replay Persistence                                                              │ │
│  │    │   └── jti_store.hasJti() - Replay detection                                      │ │
│  │    │   └── jti_store.recordJti() - Record jti                                         │ │
│  │    │                                                                                   │ │
│  │    └── InsightFlow (:3005)                                                             │ │
│  │        └── POST /api/v1/telemetry (via adapter.js)                                     │ │
│  │            └── Payload: {source, trace_id, execution_id, event_type, status, payload}  │ │
│  │                                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                              EXECUTION (:3003)                                          │ │
│  │                                                                                         │ │
│  │  Integration Points:                                                                   │ │
│  │    ├── Sarathi (:3001)                                                                 │ │
│  │    │   └── GET /.well-known/jwks.json                                                  │ │
│  │    │       └── Response: {keys: [{kid, alg, kty, ...}]}                                │ │
│  │    │                                                                                   │ │
│  │    ├── Bucket (:3004)                                                                  │ │
│  │    │   └── POST /store                                                                 │ │
│  │    │       └── Body: {trace_id, execution_id, result, timestamp, duration_ms}          │ │
│  │    │       └── Response: {location, trace_id, execution_id, hash, verified}            │ │
│  │    │                                                                                   │ │
│  │    ├── Replay Persistence                                                              │ │
│  │    │   └── replay_hooks.js - Telemetry recording                                      │ │
│  │    │                                                                                   │ │
│  │    └── InsightFlow (:3005)                                                             │ │
│  │        └── POST /api/v1/telemetry (via replay_hooks.js)                                │ │
│  │            └── Payload: {source, trace_id, execution_id, event_type, status, payload}  │ │
│  │                                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                              BUCKET (:3004)                                             │ │
│  │                                                                                         │ │
│  │  Integration Points:                                                                   │ │
│  │    └── (No outgoing integrations - SQLite storage only)                                │ │
│  │                                                                                         │ │
│  │  Provides:                                                                             │ │
│  │    ├── POST /store - Artifact storage                                                  │ │
│  │    ├── GET /retrieve/{trace_id}/{execution_id} - Artifact retrieval                    │ │
│  │    └── GET /health - Health check                                                      │ │
│  │                                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                              INSIGHTFLOW (:3005)                                        │ │
│  │                                                                                         │ │
│  │  Integration Points:                                                                   │ │
│  │    └── (No outgoing integrations - file storage only)                                  │ │
│  │                                                                                         │ │
│  │  Receives:                                                                             │ │
│  │    ├── POST /api/v1/telemetry - Telemetry events                                       │ │
│  │    │   └── From: Bridge (via adapter.js)                                               │ │
│  │    │   └── From: Execution (via replay_hooks.js)                                       │ │
│  │    │                                                                                   │ │
│  │  Provides:                                                                             │ │
│  │    ├── GET /telemetry - Query events                                                   │ │
│  │    ├── GET /telemetry/{traceId} - Query events by trace                                │ │
│  │    ├── GET /telemetry/summary - Telemetry summary                                      │ │
│  │    └── GET /health - Health check                                                      │ │
│  │                                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Integration Contracts

### Setu → Core Contract

```json
// Request
POST /initiate
{
    "workload": "string",
    "source": "setu",
    "setu_request_id": "string",
    "user_metadata": {}
}

// Response
{
    "trace_id": "uuid",
    "execution_id": "uuid",
    "cet_hash": "sha256-hex",
    "status": "completed",
    "result": {}
}
```

### Core → Sarathi Contract

```json
// Request
POST /token
{
    "trace_id": "uuid",
    "execution_id": "uuid",
    "cet_hash": "sha256-hex",
    "algorithm": "RS256" | "EdDSA"
}

// Response
{
    "token": "jwt-string",
    "trace_id": "uuid",
    "execution_id": "uuid",
    "jti": "uuid",
    "algorithm": "RS256" | "EdDSA"
}
```

### Core → Bridge Contract

```json
// Request
POST /execute
Headers:
    Authorization: Bearer <jwt>
    X-Sarathi-Trace-Id: <trace_id>
    X-Sarathi-Execution-Id: <execution_id>
    X-Sarathi-Cet-Hash: <cet_hash>

Body:
{
    "workload": "string",
    "trace_id": "uuid",
    "execution_id": "uuid",
    "cet_hash": "sha256-hex"
}

// Response
{
    "trace_id": "uuid",
    "execution_id": "uuid",
    "status": "completed",
    "result": {},
    "artifact_location": "artifacts/trace_id/execution_id",
    "duration_ms": 123
}
```

### Bridge → Execution Contract

```json
// Request
POST /run
Body:
{
    "workload": "string",
    "trace_id": "uuid",
    "execution_id": "uuid",
    "bridge_signature": "Bearer <jwt>"
}

// Response
{
    "trace_id": "uuid",
    "execution_id": "uuid",
    "status": "completed",
    "result": {},
    "artifact_location": "artifacts/trace_id/execution_id",
    "duration_ms": 123
}
```

### Execution → Bucket Contract

```json
// Request
POST /store
Body:
{
    "trace_id": "uuid",
    "execution_id": "uuid",
    "result": {},
    "timestamp": "ISO-8601",
    "duration_ms": 123
}

// Response
{
    "location": "artifacts/trace_id/execution_id",
    "trace_id": "uuid",
    "execution_id": "uuid",
    "hash": "sha256-hex",
    "verified": true,
    "persistent": true
}
```

### InsightFlow Telemetry Contract

```json
// Request
POST /api/v1/telemetry
Body:
{
    "source": "tantra-bridge",
    "trace_id": "uuid",
    "execution_id": "uuid",
    "event_type": "execution_transition" | "rejection" | "dependency_failure" | "replay_verification",
    "status": "pending" | "processing" | "completed" | "failed" | "rejected",
    "payload": {
        "passive": true,
        ...
    },
    "timestamp": "ISO-8601"
}

// Response
{
    "received": true,
    "timestamp": "ISO-8601"
}
```

## Data Flow Diagrams

### Forward Path (Request)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              FORWARD PATH (REQUEST)                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  User                                                                                        │
│    │                                                                                         │
│    │  {workload: "task"}                                                                     │
│    ▼                                                                                         │
│  Setu (:8000)                                                                                │
│    │                                                                                         │
│    │  {workload, source, setu_request_id}                                                    │
│    ▼                                                                                         │
│  Core (:3000)                                                                                │
│    │                                                                                         │
│    │  {trace_id, execution_id, cet_hash}                                                     │
│    ├──▶ Sarathi (:3001)                                                                      │
│    │      │                                                                                  │
│    │      │  {token}                                                                         │
│    │◀─────┘                                                                                  │
│    │                                                                                         │
│    │  {workload, trace_id, execution_id, cet_hash} + JWT                                     │
│    ▼                                                                                         │
│  Bridge (:3002)                                                                              │
│    │  - Validates JWT                                                                        │
│    │  - Enforces ID immutability                                                             │
│    │  - Records jti                                                                          │
│    │                                                                                         │
│    │  {workload, trace_id, execution_id, bridge_signature}                                   │
│    ▼                                                                                         │
│  Execution (:3003)                                                                           │
│    │  - Validates bridge signature                                                           │
│    │  - Executes workload                                                                    │
│    │                                                                                         │
│    │  {trace_id, execution_id, result, timestamp, duration_ms}                               │
│    ▼                                                                                         │
│  Bucket (:3004)                                                                              │
│    │  - Stores artifact                                                                      │
│    │  - Generates hash                                                                       │
│    │                                                                                         │
│    │  {location, hash, verified}                                                             │
│    ▼                                                                                         │
│  (Artifact stored)                                                                           │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Return Path (Response)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              RETURN PATH (RESPONSE)                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  Bucket (:3004)                                                                              │
│    │                                                                                         │
│    │  {location, trace_id, execution_id, hash, verified}                                     │
│    ▼                                                                                         │
│  Execution (:3003)                                                                           │
│    │                                                                                         │
│    │  {trace_id, execution_id, status, result, artifact_location, duration_ms}              │
│    ▼                                                                                         │
│  Bridge (:3002)                                                                              │
│    │  - Emits completion telemetry                                                           │
│    │                                                                                         │
│    │  (execution response data)                                                              │
│    ▼                                                                                         │
│  Core (:3000)                                                                                │
│    │  - Wraps response with trace_id, execution_id, cet_hash                                 │
│    │                                                                                         │
│    │  {trace_id, execution_id, cet_hash, status, result}                                     │
│    ▼                                                                                         │
│  Setu (:8000)                                                                                │
│    │  - Constructs ProcessResponse                                                           │
│    │  - Includes runtime_chain                                                               │
│    │                                                                                         │
│    │  ProcessResponse {                                                                      │
│    │    status, trace_id, execution_id, cet_hash,                                            │
│    │    result, artifact_location, duration_ms,                                              │
│    │    runtime_chain, setu_request_id, timestamp                                            │
│    │  }                                                                                      │
│    ▼                                                                                         │
│  User                                                                                        │
│    - Receives complete response                                                              │
│    - Can verify trace_id, execution_id                                                       │
│    - Can retrieve artifact                                                                   │
│    - Can query telemetry                                                                     │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Telemetry Path (Async Side-Effect)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              TELEMETRY PATH (ASYNC SIDE-EFFECT)                             │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  Bridge (:3002)                                                                              │
│    │                                                                                         │
│    │  replay_hooks.hookServiceTransition()                                                   │
│    │  replay_hooks.hookRejection()                                                           │
│    │  replay_hooks.hookExecutionResponse()                                                   │
│    │  replay_hooks.hookExecutionFailure()                                                    │
│    │                                                                                         │
│    ▼                                                                                         │
│  InsightFlow Adapter (adapter.js)                                                            │
│    │                                                                                         │
│    │  POST /api/v1/telemetry                                                                 │
│    │  {source, trace_id, execution_id, event_type, status, payload}                          │
│    │                                                                                         │
│    ▼                                                                                         │
│  InsightFlow (:3005)                                                                         │
│    │  - Stores telemetry in JSONL file                                                       │
│    │  - Queryable via API                                                                    │
│    │                                                                                         │
│    ▼                                                                                         │
│  data/insightflow_telemetry.jsonl                                                            │
│                                                                                             │
│  ---                                                                                         │
│                                                                                             │
│  Execution (:3003)                                                                           │
│    │                                                                                         │
│    │  replay_hooks.hookServiceTransition()                                                   │
│    │  replay_hooks.hookExecutionResponse()                                                   │
│    │  replay_hooks.hookExecutionFailure()                                                    │
│    │                                                                                         │
│    ▼                                                                                         │
│  InsightFlow Adapter (adapter.js)                                                            │
│    │                                                                                         │
│    │  POST /api/v1/telemetry                                                                 │
│    │  {source, trace_id, execution_id, event_type, status, payload}                          │
│    │                                                                                         │
│    ▼                                                                                         │
│  InsightFlow (:3005)                                                                         │
│    │  - Stores telemetry in JSONL file                                                       │
│    │                                                                                         │
│    ▼                                                                                         │
│  data/insightflow_telemetry.jsonl                                                            │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Error Propagation

### Failure Scenarios

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              FAILURE PROPAGATION                                             │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  Scenario 1: Sarathi Down                                                                   │
│  ───────────────────────                                                                    │
│  Core → Sarathi: Connection refused                                                         │
│  Core → Setu: 503 "System stopped: dependency unavailable"                                  │
│  Setu → User: HTTP 503                                                                      │
│                                                                                             │
│  Scenario 2: Invalid Token                                                                  │
│  ───────────────────────                                                                    │
│  Core → Bridge: Bearer <invalid-jwt>                                                        │
│  Bridge → Execution: (not reached)                                                          │
│  Bridge → Core: 401 "Unauthorized: Invalid token"                                           │
│  Core → Setu: 401                                                                           │
│  Setu → User: HTTP 401                                                                      │
│                                                                                             │
│  Scenario 3: Replay Attack                                                                  │
│  ───────────────────────                                                                    │
│  Core → Bridge: Bearer <reused-jwt>                                                         │
│  Bridge → Execution: (not reached)                                                          │
│  Bridge → Core: 401 "Unauthorized: Token replay detected"                                   │
│  Core → Setu: 401                                                                           │
│  Setu → User: HTTP 401                                                                      │
│                                                                                             │
│  Scenario 4: ID Mutation                                                                    │
│  ───────────────────────                                                                    │
│  Core → Bridge: Body trace_id ≠ Token trace_id                                              │
│  Bridge → Execution: (not reached)                                                          │
│  Bridge → Core: 400 "trace_id mutation forbidden"                                           │
│  Core → Setu: 400                                                                           │
│  Setu → User: HTTP 400                                                                      │
│                                                                                             │
│  Scenario 5: Execution Down                                                                 │
│  ───────────────────────                                                                    │
│  Bridge → Execution: Connection refused                                                     │
│  Bridge → Core: 503 "Execution service unavailable - system stopped"                        │
│  Core → Setu: 503                                                                           │
│  Setu → User: HTTP 503                                                                      │
│                                                                                             │
│  Scenario 6: Bucket Failure                                                                 │
│  ───────────────────────                                                                    │
│  Execution → Bucket: Storage failed                                                         │
│  Execution → Bridge: 500 "Bucket storage failed - system stopped"                           │
│  Bridge → Core: 500                                                                         │
│  Core → Setu: 500                                                                           │
│  Setu → User: HTTP 500                                                                      │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Validation Scripts

### Lifecycle Validation

```bash
# Bash
bash scripts/lifecycle_validation.sh --proof

# PowerShell
.\scripts\lifecycle_validation.ps1 -Proof
```

### Integration Verification

```bash
# Bash
bash scripts/integration_verify.sh
```

### Service Verification

```bash
# Bash
bash scripts/verify_services.sh

# PowerShell
.\scripts\verify.ps1
```
