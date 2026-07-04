# TANTRA Integration Map

## System Architecture

```
                    ┌─────────────────────────────────────────┐
                    │              Core Service                │
                    │              (Port 3000)                 │
                    │  - Workflow initiation                   │
                    │  - Token request orchestration           │
                    └──────────────┬──────────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────────┐
                    │            Sarathi Service               │
                    │            (Port 3001)                   │
                    │  - JWT token generation (RS256/EdDSA)   │
                    │  - JWKS endpoint                        │
                    │  - Key pair management                   │
                    └──────────────┬──────────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────────┐
                    │            Bridge Service                │
                    │            (Port 3002)                   │
                    │  - Zero-trust enforcement                │
                    │  - JWT validation                        │
                    │  - Trace ID immutability check           │
                    │  - Replay attack detection (jti)         │
                    └──────────────┬──────────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────────┐
                    │          Execution Service               │
                    │          (Port 3003)                     │
                    │  - Workload processing                   │
                    │  - Artifact generation                   │
                    │  - Replay chain recording                │
                    └──────────────┬──────────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────────┐
                    │           Bucket Service                 │
                    │           (Port 3004)                    │
                    │  - Artifact storage (SQLite)             │
                    │  - SHA-256 hash verification             │
                    │  - Read-after-write consistency          │
                    └──────────────┬──────────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────────┐
                    │        InsightFlow Service               │
                    │        (Port 3005)                       │
                    │  - Telemetry ingestion                   │
                    │  - Trace correlation                     │
                    └─────────────────────────────────────────┘
```

## Service Dependencies

| Service | Depends On | Protocol |
|---------|-----------|----------|
| Core | Sarathi, Bridge | HTTP |
| Sarathi | None (standalone) | - |
| Bridge | Sarathi, Execution | HTTP + JWT |
| Execution | Sarathi, Bucket | HTTP + JWT |
| Bucket | None (standalone) | - |
| InsightFlow | None (standalone) | - |

## API Contracts

### Core Service (Port 3000)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/initiate` | POST | Start workflow (generates trace_id, execution_id) |

**Initiate Request:**
```json
{
  "workload": "string",
  "action": "string",
  "payload": {}
}
```

**Initiate Response:**
```json
{
  "trace_id": "uuid",
  "execution_id": "uuid",
  "status": "completed",
  "result": { ... }
}
```

### Sarathi Service (Port 3001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with issuer info |
| `/token` | POST | Generate JWT token |
| `/.well-known/jwks.json` | GET | JWKS endpoint for key resolution |

**Token Request:**
```json
{
  "trace_id": "string",
  "execution_id": "string",
  "cet_hash": "string (sha256)"
}
```

**Token Response:**
```json
{
  "token": "jwt-string",
  "jti": "uuid",
  "trace_id": "string",
  "execution_id": "string",
  "algorithm": "RS256|EdDSA"
}
```

### Bridge Service (Port 3002)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/execute` | POST | Validate token and forward to Execution |

**Execute Request:**
```json
{
  "workload": "string",
  "trace_id": "string",
  "execution_id": "string"
}
```

**Headers Required:**
- `Authorization: Bearer <jwt-token>`
- `X-Sarathi-Trace-Id: <trace_id>`
- `X-Sarathi-Cet-Hash: <cet_hash>`

### Execution Service (Port 3003)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/execute` | POST | Process workload and store artifact |

### Bucket Service (Port 3004)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/store` | POST | Store artifact |
| `/retrieve/:trace_id/:execution_id` | GET | Retrieve artifact |

**Store Request:**
```json
{
  "trace_id": "string",
  "execution_id": "string",
  "result": {},
  "timestamp": "ISO8601",
  "duration_ms": number
}
```

### InsightFlow Service (Port 3005)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/v1/telemetry` | POST | Ingest telemetry event |
| `/telemetry` | GET | Query telemetry (optional `?trace_id=`) |
| `/telemetry/:traceId` | GET | Get telemetry for specific trace |
| `/telemetry/summary` | GET | Aggregated telemetry summary |

## Security Model

1. **JWT Authentication:** Bridge validates JWT tokens from Sarathi
2. **Zero-Trust:** Bridge enforces trace_id and cet_hash immutability
3. **Replay Protection:** jti (JWT ID) tracking prevents token reuse
4. **Key Rotation:** Sarathi generates new key pairs on restart
5. **Hash Verification:** Bucket stores SHA-256 hashes for artifact integrity

## Network Configuration

All services communicate over Docker bridge network `tantra-network`. External access is via port mapping (3000-3005).

## Data Flow

1. Client → Core (`/initiate`)
2. Core → Sarathi (`/token`)
3. Sarathi → Core (JWT token)
4. Core → Bridge (`/execute`)
5. Bridge validates JWT, enforces immutability
6. Bridge → Execution (`/execute`)
7. Execution → Bucket (`/store`)
8. Bucket returns artifact with hash
9. Execution → Bridge (result)
10. Bridge → Core (result)
11. Core → Client (response)
12. InsightFlow receives telemetry events asynchronously
