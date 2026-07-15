# TANTRA Runtime Flow Diagram

## Complete Lifecycle Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                           TANTRA RUNTIME COMPLETE LIFECYCLE                                  │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│   ┌──────┐    ┌──────┐    ┌──────┐    ┌────────┐    ┌────────┐    ┌──────────┐    ┌──────┐  │
│   │ User │───▶│ Setu │───▶│ Core │───▶│Sarathi │───▶│ Bridge │───▶│Execution │───▶│Bucket│  │
│   └──────┘    └──────┘    └──────┘    └────────┘    └────────┘    └──────────┘    └──────┘  │
│       ▲                                                       │               │              │
│       │                                                       ▼               ▼              │
│       │                                                  ┌──────────┐    ┌──────────┐        │
│       │                                                  │InsightFlow│    │ Replay   │        │
│       │                                                  │  (:3005) │    │Persistence│        │
│       │                                                  └──────────┘    └──────────┘        │
│       │                                                       │                              │
│       │                                                       ▼                              │
│       │                                                  (telemetry recorded)                │
│       │                                                                                      │
│       │    ┌──────┐    ┌──────┐    ┌──────┐    ┌────────┐    ┌──────────┐    ┌──────┐       │
│       └────│ Setu │◀───│ Core │◀───│Bridge│◀───│Execution│◀───│  Bucket  │    │      │       │
│            └──────┘    └──────┘    └──────┘    └────────┘    └──────────┘    └──────┘       │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Detailed Flow Phases

### Phase 1: Request Initiation

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: REQUEST INITIATION                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  User                                                                    │
│    │                                                                     │
│    │  POST /process                                                      │
│    │  {workload: "task-name", metadata: {}}                              │
│    │                                                                     │
│    ▼                                                                     │
│  Setu (:8000)                                                            │
│    │  - Assigns setu_request_id                                          │
│    │  - Timestamps request                                               │
│    │  - Validates input                                                  │
│    │                                                                     │
│    │  POST /initiate                                                     │
│    │  {workload: "task-name", source: "setu", setu_request_id: "..."}    │
│    │                                                                     │
│    ▼                                                                     │
│  Core (:3000)                                                            │
│    │  - Generates trace_id (UUID)                                        │
│    │  - Generates execution_id (UUID)                                    │
│    │  - Computes cet_hash = SHA-256(trace_id:execution_id)              │
│    │                                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Phase 2: JWT Authorization

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 2: JWT AUTHORIZATION                                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Core (:3000)                                                            │
│    │                                                                     │
│    │  POST /token                                                        │
│    │  {trace_id, execution_id, cet_hash}                                 │
│    │                                                                     │
│    ▼                                                                     │
│  Sarathi (:3001)                                                         │
│    │  - Validates trace_id + execution_id                                │
│    │  - Generates jti (JWT ID)                                           │
│    │  - Creates JWT claims:                                              │
│    │    {                                                                │
│    │      trace_id, execution_id,                                        │
│    │      iss: "tantra-sarathi",                                         │
│    │      aud: "tantra-bridge",                                          │
│    │      jti, iat, exp,                                                 │
│    │      cet_hash                                                       │
│    │    }                                                                │
│    │  - Signs with RS256 or EdDSA                                        │
│    │                                                                     │
│    │  Returns: {token, trace_id, execution_id, jti, algorithm}           │
│    │                                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Phase 3: Bridge Transport

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 3: BRIDGE TRANSPORT                                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Core (:3000)                                                            │
│    │                                                                     │
│    │  POST /execute                                                      │
│    │  Headers:                                                           │
│    │    Authorization: Bearer <jwt>                                      │
│    │    X-Sarathi-Trace-Id: <trace_id>                                   │
│    │    X-Sarathi-Execution-Id: <execution_id>                           │
│    │    X-Sarathi-Cet-Hash: <cet_hash>                                   │
│    │  Body: {workload, trace_id, execution_id, cet_hash}                 │
│    │                                                                     │
│    ▼                                                                     │
│  Bridge (:3002)                                                          │
│    │  PASSIVE FORWARDER ONLY                                             │
│    │  - Validates JWT signature (RS256/EdDSA)                            │
│    │  - Validates issuer: tantra-sarathi                                 │
│    │  - Validates audience: tantra-bridge                                │
│    │  - Checks replay (jti uniqueness)                                   │
│    │  - Enforces ID immutability:                                        │
│    │    - Body trace_id == Token trace_id                                │
│    │    - Body execution_id == Token execution_id                        │
│    │    - Body cet_hash == Token cet_hash                                │
│    │  - Records jti in replay store                                      │
│    │  - Emits telemetry to InsightFlow                                   │
│    │                                                                     │
│    │  FORBIDDEN:                                                         │
│    │    - Cannot generate tokens                                         │
│    │    - Cannot execute workloads                                       │
│    │    - Cannot store artifacts                                          │
│    │    - Cannot create fallback paths                                   │
│    │                                                                     │
│    │  POST /run                                                          │
│    │  Body: {workload, trace_id, execution_id, bridge_signature}         │
│    │                                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Phase 4: Execution and Storage

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 4: EXECUTION AND STORAGE                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Bridge (:3002)                                                          │
│    │                                                                     │
│    ▼                                                                     │
│  Execution (:3003)                                                       │
│    │  - Validates bridge signature (JWT from Sarathi)                    │
│    │  - Enforces ID immutability                                         │
│    │  - Executes workload:                                               │
│    │    - Loads execution_participant.js (if configured)                 │
│    │    - Or runs default executor                                       │
│    │  - Generates result                                                 │
│    │  - Records duration                                                 │
│    │                                                                     │
│    │  POST /store                                                        │
│    │  {trace_id, execution_id, result, timestamp, duration_ms}           │
│    │                                                                     │
│    ▼                                                                     │
│  Bucket (:3004)                                                          │
│    │  - SQLite storage                                                   │
│    │  - Schema validation                                                │
│    │  - SHA-256 hash generation                                          │
│    │  - Stores artifact                                                  │
│    │  - Read-after-write verification                                    │
│    │  - Hash verification                                                │
│    │                                                                     │
│    │  Returns: {location, trace_id, execution_id, hash, verified}        │
│    │                                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Phase 5: Response Return Path

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 5: RESPONSE RETURN PATH                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Bucket (:3004)                                                          │
│    │                                                                     │
│    │  Returns: {location, trace_id, execution_id, hash, verified}        │
│    │                                                                     │
│    ▼                                                                     │
│  Execution (:3003)                                                       │
│    │                                                                     │
│    │  Returns: {                                                         │
│    │    trace_id, execution_id,                                          │
│    │    status: "completed",                                             │
│    │    result: {...},                                                   │
│    │    artifact_location: "artifacts/trace_id/execution_id",            │
│    │    duration_ms: 123                                                 │
│    │  }                                                                  │
│    │                                                                     │
│    ▼                                                                     │
│  Bridge (:3002)                                                          │
│    │  - Forwards execution response                                      │
│    │  - Emits completion telemetry                                       │
│    │                                                                     │
│    │  Returns: execution response data                                   │
│    │                                                                     │
│    ▼                                                                     │
│  Core (:3000)                                                            │
│    │  - Wraps response with trace_id, execution_id, cet_hash             │
│    │                                                                     │
│    │  Returns: {                                                         │
│    │    trace_id, execution_id, cet_hash,                                │
│    │    status: "completed",                                             │
│    │    result: {...}                                                    │
│    │  }                                                                  │
│    │                                                                     │
│    ▼                                                                     │
│  Setu (:8000)                                                            │
│    │  - Constructs ProcessResponse                                       │
│    │  - Includes runtime_chain                                           │
│    │  - Calculates duration_ms                                           │
│    │                                                                     │
│    │  Returns: ProcessResponse {                                         │
│    │    status, trace_id, execution_id, cet_hash,                        │
│    │    result, artifact_location, duration_ms,                          │
│    │    runtime_chain, setu_request_id, timestamp                        │
│    │  }                                                                  │
│    │                                                                     │
│    ▼                                                                     │
│  User                                                                     │
│    - Receives complete response                                          │
│    - Can verify trace_id, execution_id                                   │
│    - Can retrieve artifact via /artifact/{trace_id}/{execution_id}       │
│    - Can check telemetry via /telemetry/{trace_id}                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Phase 6: Telemetry (Async Side-Effect)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 6: TELEMETRY (ASYNC SIDE-EFFECT)                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  InsightFlow (:3005)                                                     │
│    │  - Receives telemetry events from Bridge and Execution              │
│    │  - Events are emitted via replay_hooks.js                           │
│    │  - Events are passive (passive: true)                               │
│    │                                                                     │
│    │  Event Types:                                                       │
│    │    - execution_transition (pending → processing → completed)        │
│    │    - rejection (token/ID validation failure)                        │
│    │    - dependency_failure (service unavailable)                       │
│    │    - replay_verification (replay check result)                      │
│    │                                                                     │
│    │  Storage: data/insightflow_telemetry.jsonl                          │
│    │  Query: GET /telemetry/{trace_id}                                   │
│    │                                                                     │
│    │  NOTE: Telemetry is a side-effect, not part of the synchronous     │
│    │        response path. The response travels back through the         │
│    │        HTTP response chain (Bucket → Execution → Bridge → Core      │
│    │        → Setu → User).                                              │
│    │                                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Summary

### Request Data

```
User Request:
  {workload: "task-name", metadata: {}}

Setu Request:
  {workload: "task-name", source: "setu", setu_request_id: "..."}

Core Request:
  {trace_id: "uuid", execution_id: "uuid", cet_hash: "sha256"}

Sarathi Token:
  JWT {trace_id, execution_id, iss, aud, jti, iat, exp, cet_hash}

Bridge Request:
  {workload, trace_id, execution_id, cet_hash}
  Headers: {Authorization, X-Sarathi-Trace-Id, X-Sarathi-Execution-Id, X-Sarathi-Cet-Hash}

Execution Request:
  {workload, trace_id, execution_id, bridge_signature: "Bearer <jwt>"}

Bucket Request:
  {trace_id, execution_id, result, timestamp, duration_ms}
```

### Response Data

```
Bucket Response:
  {location, trace_id, execution_id, hash, verified, persistent}

Execution Response:
  {trace_id, execution_id, status, result, artifact_location, duration_ms}

Bridge Response:
  (execution response data)

Core Response:
  {trace_id, execution_id, cet_hash, status, result}

Setu Response:
  ProcessResponse {
    status, trace_id, execution_id, cet_hash,
    result, artifact_location, duration_ms,
    runtime_chain, setu_request_id, timestamp
  }
```

## Trace Continuity

### Immutable Identifiers

| Identifier | Generated By | Propagated To | Enforced At |
|------------|--------------|---------------|-------------|
| trace_id | Core | All services | Bridge, Execution |
| execution_id | Core | All services | Bridge, Execution |
| cet_hash | Core | All services | Bridge |
| jti | Sarathi | Bridge, Execution | Bridge (replay) |

### Continuity Headers

| Header | Set By | Verified By |
|--------|--------|-------------|
| Authorization: Bearer <jwt> | Core | Bridge, Execution |
| X-Sarathi-Trace-Id | Core | Bridge |
| X-Sarathi-Execution-Id | Core | Bridge |
| X-Sarathi-Cet-Hash | Core | Bridge |

## Security Boundaries

### Zero-Trust Enforcement

1. **No Local Signing**: Bridge cannot sign tokens - must use Sarathi
2. **No Local Execution**: Bridge cannot execute workloads - must use Execution
3. **No Fallback Paths**: All failures stop the system immediately
4. **Immutable IDs**: trace_id and execution_id cannot be mutated
5. **External Verification**: All services verify JWTs via Sarathi's public key

### Failure Propagation

- Sarathi down → Core BLOCKS
- Invalid token → Bridge BLOCKS
- ID mutation → Bridge BLOCKS (400)
- Replay detected → Bridge BLOCKS (401)
- Execution down → Bridge FAILS (503)
- Bucket failure → Execution FAILS (500)

## Validation

### Running Validation

```bash
# Bash
bash scripts/lifecycle_validation.sh --proof

# PowerShell
.\scripts\lifecycle_validation.ps1 -Proof
```

### Evidence Collection

The validation script collects evidence for:
1. Service health verification
2. User request to Setu
3. Setu response to user (return path)
4. Core request verification
5. Bucket artifact verification
6. Replay persistence verification
7. InsightFlow telemetry verification
8. Execution response verification
9. Bridge transport verification
10. Complete lifecycle summary
