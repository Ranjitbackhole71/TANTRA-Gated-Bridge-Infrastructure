# TANTRA API Documentation

## Core Service (:3000)

### Health Check
```
GET /health
```
**Response**:
```json
{
  "service": "core",
  "status": "healthy"
}
```

### Sarathi Dependency Diagnostic
```
GET /diagnostic/sarathi-health
```
**Response** (200): includes `resolved_url`, dependency `status`/`body` or error details, `duration_ms`, and runtime environment/version information.

### Initiate Workflow
```
POST /initiate
Content-Type: application/json
```
**Request Body**:
```json
{
  "workload": "string (optional)"
}
```
**Response** (200):
```json
{
  "trace_id": "uuid",
  "execution_id": "uuid",
  "cet_hash": "sha256-hex",
  "status": "completed",
  "result": {
    "trace_id": "uuid",
    "execution_id": "uuid",
    "status": "completed",
    "result": { ... },
    "artifact_location": "artifacts/{trace_id}/{execution_id}",
    "duration_ms": 123
  }
}
```
**Error Response** (503):
```json
{
  "error": "System stopped: dependency unavailable",
  "trace_id": "uuid",
  "execution_id": "uuid",
  "cet_hash": "sha256-hex"
}
```
Core forwards downstream `400` or `401` responses from Sarathi/Bridge, preserving their status and body while adding the generated execution identifiers and CET hash.

---

## Sarathi Service (:3001)

### Health Check
```
GET /health
```
**Response**:
```json
{
  "service": "sarathi",
  "status": "healthy",
  "issuer": "tantra-sarathi",
  "algorithms": ["RS256", "EdDSA"]
}
```

### Issue Token
```
POST /token
Content-Type: application/json
```
**Request Body**:
```json
{
  "trace_id": "uuid (required)",
  "execution_id": "uuid (required)",
  "cet_hash": "sha256-hex (optional)",
  "algorithm": "EdDSA|RS256 (default: EdDSA)"
}
```
**Response** (200):
```json
{
  "token": "jwt-string",
  "trace_id": "uuid",
  "execution_id": "uuid",
  "jti": "uuid",
  "algorithm": "EdDSA"
}
```
**Error Response** (400): missing `trace_id` or `execution_id`.

### Get Public Key (Legacy)
```
GET /public-key
```
**Response**:
```json
{
  "public_key": "pem-string"
}
```

### Get JWKS
```
GET /jwks
GET /.well-known/jwks.json
```
**Response**:
```json
{
  "keys": [
    {
      "kty": "OKP",
      "crv": "Ed25519",
      "x": "base64url",
      "alg": "EdDSA",
      "kid": "uuid",
      "use": "sig"
    },
    {
      "kty": "RSA",
      "n": "base64url",
      "e": "base64url",
      "alg": "RS256",
      "kid": "uuid",
      "use": "sig"
    }
  ]
}
```

---

## Bridge Service (:3002)

### Health Check
```
GET /health
```
**Response**:
```json
{
  "service": "bridge",
  "status": "healthy",
  "algorithms": ["RS256", "EdDSA"]
}
```

### Execute Workflow
```
POST /execute
Authorization: Bearer <jwt-token>
X-Sarathi-Trace-Id: <trace_id>
X-Sarathi-Execution-Id: <execution_id>
X-Sarathi-Cet-Hash: <cet_hash>
Content-Type: application/json
```
**Request Body**:
```json
{
  "workload": "string",
  "trace_id": "uuid (must match token)",
  "execution_id": "uuid (must match token)",
  "cet_hash": "sha256-hex (must match token)"
}
```
**Response** (200): Forwarded from Execution service
**Error Responses**:
- `401` — Missing/invalid token, replay detected, missing jti
- `400` — ID mutation detected, cet_hash mismatch
- `503` — Execution service unavailable

---

## Execution Service (:3003)

### Health Check
```
GET /health
```
**Response**:
```json
{
  "service": "execution",
  "status": "healthy",
  "algorithms": ["RS256", "EdDSA"]
}
```

### Run Workload
```
POST /run
Content-Type: application/json
```
**Request Body** (includes bridge_signature):
```json
{
  "workload": "string",
  "trace_id": "uuid",
  "execution_id": "uuid",
  "bridge_signature": "Bearer <jwt-token>"
}
```
**Response** (200):
```json
{
  "trace_id": "uuid",
  "execution_id": "uuid",
  "status": "completed",
  "result": {
    "workload": "string",
    "output": "Processed string",
    "trace_id": "uuid",
    "execution_id": "uuid",
    "hash": "sha256-hex",
    "output_file": "/path/to/file.json"
  },
  "artifact_location": "artifacts/{trace_id}/{execution_id}",
  "duration_ms": 123
}
```
**Error Responses**:
- `401` — Missing or invalid `bridge_signature`
- `400` — `trace_id` or `execution_id` does not match the signed token
- `503` — Execution participant or Bucket dependency unavailable

### Execution API Description
```
GET /docs
GET /docs.json
```
`/docs` serves Swagger UI; `/docs.json` returns the OpenAPI document.

---

## Bucket Service (:3004)

### Health Check
```
GET /health
```
**Response**:
```json
{
  "service": "bucket",
  "status": "healthy"
}
```

### Store Artifact
```
POST /store
Content-Type: application/json
```
**Request Body**:
```json
{
  "trace_id": "uuid (required)",
  "execution_id": "uuid (required)",
  "result": "object (required)",
  "timestamp": "iso8601 (optional)",
  "duration_ms": "number (optional)"
}
```
**Response** (201):
```json
{
  "location": "artifacts/{trace_id}/{execution_id}",
  "trace_id": "uuid",
  "execution_id": "uuid",
  "hash": "sha256-hex",
  "metadata": {
    "artifact_id": "artifacts/{trace_id}/{execution_id}",
    "trace_id": "uuid",
    "execution_id": "uuid",
    "hash": "sha256-hex",
    "hash_algorithm": "sha256",
    "hash_basis": "sha256(trace_id, execution_id, result, timestamp, duration_ms, stored_at)",
    "timestamp": "iso8601",
    "stored_at": "iso8601",
    "created_at": 1758000000,
    "duration_ms": 0,
    "service": "bucket",
    "source": "bucket",
    "content_type": "application/json",
    "schema": { "type": "object", "fields": ["..."] }
  },
  "verified": true,
  "persistent": true
}
```
**Error Response** (400): missing `trace_id`, `execution_id`, or `result`.

> `metadata` is extracted automatically from the stored artifact row at store time and again at retrieve time (see `services/bucket/metadata.js`). All values are derived from the real stored artifact; none are fabricated.

### Retrieve Artifact
```
GET /retrieve/:trace_id/:execution_id
```
**Response** (200):
```json
{
  "trace_id": "uuid",
  "execution_id": "uuid",
  "result": "object",
  "timestamp": "iso8601",
  "duration_ms": "number",
  "stored_at": "iso8601",
  "hash": "sha256-hex",
  "metadata": { "...": "same structure as the /store metadata object" }
}
```
**Error Response** (404):
```json
{
  "error": "Artifact not found"
}
```

---

## InsightFlow Telemetry Receiver (internal service `tantra-insightflow:3005`)

> In production, `tantra-bridge` sends telemetry to the internal Docker-network service `tantra-insightflow` on port 3005 (`INSIGHTFLOW_URL=http://tantra-insightflow:3005`). For local development, use `http://localhost:3005`.

> **Note:** `163.128.209.18:8122` is a separate external **InsightBridge** enforcement service and is NOT the TANTRA telemetry receiver.

### Health Check
```
GET /health
```
**Response**:
```json
{
  "service": "insightflow-local",
  "status": "healthy",
  "port": 3005
}
```

### Submit Telemetry
```
POST /api/v1/telemetry
Content-Type: application/json
```
**Request Body**: Any JSON payload
**Response** (201):
```json
{
  "received": true,
  "timestamp": "iso8601"
}
```
**Error Response** (500): telemetry storage failed.

### Query Telemetry
```
GET /telemetry?trace_id=<id>&limit=<n>
GET /telemetry/:traceId
GET /telemetry/summary
```

`GET /telemetry` returns `{ trace_id, count, total, events }`; `trace_id` is `null` when no trace filter is supplied. `GET /telemetry/:traceId` returns `{ trace_id, count, events }`. `GET /telemetry/summary` returns `{ total_events, unique_traces, traces }`, where each trace summary contains `trace_id`, `event_count`, `sources`, `first_seen`, and `last_seen`.

---

## Gateway (:8000)

### Platform Health
```
GET /platform/health
```

### Platform Services
```
GET /platform/services
```

### Platform Runtime
```
GET /platform/runtime
```

### Platform Metrics
```
GET /platform/metrics
```

### Platform Version
```
GET /platform/version
```

### Platform Config
```
GET /platform/config
```

### API Documentation
```
GET /docs      (Swagger UI)
GET /redoc     (ReDoc)
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad Request (ID mutation, cet_hash mismatch) |
| 401 | Unauthorized (missing/invalid token, replay detected) |
| 404 | Not Found (artifact not found) |
| 500 | Internal Server Error (storage failure) |
| 503 | Service Unavailable (dependency failure) |
