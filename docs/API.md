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
  "verified": true,
  "persistent": true
}
```

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
  "hash": "sha256-hex"
}
```
**Error Response** (404):
```json
{
  "error": "Artifact not found"
}
```

---

## InsightFlow Local Receiver (:3005)

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

### Query Telemetry
```
GET /telemetry?trace_id=<id>&limit=<n>
GET /telemetry/:traceId
GET /telemetry/summary
```

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
