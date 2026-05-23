# AUDIT: Runtime Validation

## Test Environment
- Platform: Windows (PowerShell)
- Node: v24.15.0
- Date: 2026-05-09

## Port Binding Verification

| Port | Service | Listening | PID | Status |
|------|---------|-----------|-----|--------|
| 3000 | core | ✅ TCP (0.0.0.0:3000) | 4140 | ✅ RUNNING |
| 3001 | sarathi | ✅ TCP (0.0.0.0:3001) | 10600 | ✅ RUNNING |
| 3002 | bridge | ✅ TCP (0.0.0.0:3002) | 3856 | ✅ RUNNING |
| 3003 | execution | ✅ TCP (0.0.0.0:3003) | 11120 | ✅ RUNNING |
| 3004 | bucket | ✅ TCP (0.0.0.0:3004) | 6312 | ✅ RUNNING |

## Health Endpoint Verification

```
GET http://localhost:3000/health → {"service":"core","status":"healthy"}
GET http://localhost:3001/health → {"service":"sarathi","status":"healthy","issuer":"tantra-sarathi"}
GET http://localhost:3002/health → {"service":"bridge","status":"healthy"}
GET http://localhost:3003/health → {"service":"execution","status":"healthy"}
GET http://localhost:3004/health → {"service":"bucket","status":"healthy"}
```

Result: ✅ ALL 5 HEALTH ENDPOINTS RESPOND

## Startup Logs Verification

| Service | Log Entries | Errors | Startup Success |
|---------|------------|--------|-----------------|
| core | 1 line: "Core Service running on port 3000" | 0 | ✅ |
| sarathi | 2 lines: "Generated new RSA key pair", "Sarathi Authority Service running on port 3001" | 0 | ✅ |
| bridge | 1 line: "Bridge Service running on port 3002" | 0 | ✅ |
| execution | 1 line: "Execution Service running on port 3003" | 0 | ✅ |
| bucket | 1 line: "Bucket Service running on port 3004" | 0 | ✅ |

Error logs (.err) are all empty for all 5 services.

## Workflow Execution Test

```
POST http://localhost:3000/initiate
Body: {"workload":"audit-test"}

Response (200):
{
  "trace_id": "d2aab052-...",
  "execution_id": "6019f8e1-...",
  "status": "completed",
  "result": {
    "trace_id": "d2aab052-...",
    "execution_id": "6019f8e1-...",
    "status": "completed",
    "result": { "workload": "audit-test", "output": "Processed audit-test", ... },
    "artifact_location": "artifacts/d2aab052-.../6019f8e1-...",
    "duration_ms": 110
  }
}
```

Result: ✅ FULL WORKFLOW COMPLETES SUCCESSFULLY

## Additional Endpoint Tests

| Endpoint | Method | Test | Response | Status |
|----------|--------|------|----------|--------|
| /public-key | GET | Sarathi public key | Public RSA key (PEM) | ✅ |
| /store | POST | Store artifact in bucket | Hash, verified=true, persistent=true | ✅ |
| /retrieve/:t/:e | GET | Retrieve stored artifact | Full artifact with hash | ✅ |

## Startup Error Analysis

Potential start.bat issue: The `for /f "tokens=*" %%i in (.env) do set %%i` command in start.bat will fail on lines containing `#` comments or blank lines. This is a minor script quality issue but does not prevent startup since the .env files don't contain comments.

## Dependency Check

| Service | Dependencies | Status |
|---------|-------------|--------|
| core | express, axios, dotenv | ✅ Installed |
| sarathi | express, jsonwebtoken, dotenv, winston | ✅ Installed (winston is imported in package.json but NOT used in app.js - dead dependency) |
| bridge | express, axios, jsonwebtoken, dotenv | ✅ Installed |
| execution | express, axios, jsonwebtoken, dotenv | ✅ Installed |
| bucket | express, better-sqlite3, dotenv | ✅ Installed |

## Verdict: ✅ All services running and operational

No startup errors, no runtime crashes, no port conflicts, no missing dependencies. Full workflow executes end-to-end.
