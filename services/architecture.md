# TANTRA Infrastructure Architecture

## System Topology

```
Core Service (Port 3000)
    ↓
Sarathi Authority Service (Port 3001)
    ↓
Bridge Service (Port 3002)
    ↓
Execution Service (Port 3003)
    ↓
Bucket Service (Port 3004)
```

## Service Responsibilities

### Core Service
- Entry point for workflows
- Generates immutable trace_id and execution_id
- Initiates token request to Sarathi
- Forwards requests to Bridge with valid JWT
- **HARD FAIL**: Stops if Sarathi or Bridge unavailable

### Sarathi Authority Service
- ONLY service that generates JWT tokens
- Uses RS256 signing (external authority only)
- Validates trace_id and execution_id inclusion
- Exposes public key endpoint for verification
- **NO token generation elsewhere in system**

### Bridge Service
- PASSIVE forwarding only
- Validates JWT from Sarathi (issuer, expiry, signature)
- Enforces immutable trace_id and execution_id
- Forwards to Execution Service
- **FORBIDDEN**: token generation, execution logic, fallback paths, mock execution
- **HARD FAIL**: Stops immediately if dependencies fail

### Execution Service
- External to Bridge (enforced separation)
- Validates bridge signature (JWT from Sarathi)
- Executes workload
- Stores artifacts in Bucket
- **HARD FAIL**: Stops if Bucket unavailable

### Bucket Service
- Artifact storage
- MANDATORY read-after-write verification
- Hash verification (SHA-256)
- Schema validation
- **HARD FAIL**: Stops if verification fails

## Zero-Trust Boundaries

1. **No Local Signing**: Bridge cannot sign tokens - must use Sarathi
2. **No Local Execution**: Bridge cannot execute workloads - must use Execution Service
3. **No Fallback Paths**: All failures stop the system immediately
4. **Immutable IDs**: trace_id and execution_id cannot be mutated across services
5. **External Verification**: All services verify JWTs via Sarathi's public key

## Failure Propagation

- Sarathi down → Core BLOCKS
- Invalid/tampered token → Bridge BLOCKS
- Execution down → Bridge FAILS
- Bucket failure → Execution FAILS
- No degraded mode, no retries masking failure

## API Contracts

### POST /initiate (Core)
Request:
```json
{
  "workload": "task-name"
}
```

Response:
```json
{
  "trace_id": "uuid",
  "execution_id": "uuid",
  "status": "completed",
  "result": { ... }
}
```

### POST /token (Sarathi)
Request:
```json
{
  "trace_id": "uuid",
  "execution_id": "uuid"
}
```

Response:
```json
{
  "token": "jwt-string",
  "trace_id": "uuid",
  "execution_id": "uuid"
}
```

### POST /execute (Bridge)
Headers:
```
Authorization: Bearer <jwt>
```

Request:
```json
{
  "workload": "task-name",
  "trace_id": "uuid",
  "execution_id": "uuid"
}
```

Response: Execution Service response

### POST /run (Execution)
Request:
```json
{
  "workload": "task-name",
  "trace_id": "uuid",
  "execution_id": "uuid",
  "bridge_signature": "Bearer <jwt>"
}
```

Response:
```json
{
  "trace_id": "uuid",
  "execution_id": "uuid",
  "status": "completed",
  "result": { ... },
  "artifact_location": "artifacts/uuid/uuid"
}
```

### POST /store (Bucket)
Request:
```json
{
  "trace_id": "uuid",
  "execution_id": "uuid",
  "result": { ... },
  "timestamp": "iso-string",
  "duration_ms": 100
}
```

Response:
```json
{
  "location": "artifacts/uuid/uuid",
  "trace_id": "uuid",
  "execution_id": "uuid",
  "hash": "sha256-hex",
  "verified": true
}
```
