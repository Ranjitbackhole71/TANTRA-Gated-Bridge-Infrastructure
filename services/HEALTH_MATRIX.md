# TANTRA Health Matrix

## Service Health Endpoints

| Service | Port | Endpoint | Expected Response |
|---------|------|----------|-------------------|
| Core | 3000 | `GET /health` | `{"service":"core","status":"healthy"}` |
| Sarathi | 3001 | `GET /health` | `{"service":"sarathi","status":"healthy","issuer":"tantra-sarathi"}` |
| Bridge | 3002 | `GET /health` | `{"service":"bridge","status":"healthy"}` |
| Execution | 3003 | `GET /health` | `{"service":"execution","status":"healthy"}` |
| Bucket | 3004 | `GET /health` | `{"service":"bucket","status":"healthy"}` |

## Dependency Health

| Upstream | Downstream | Impact if Down |
|----------|-----------|----------------|
| Core | Sarathi | BLOCK — No workflow can start |
| Core | Bridge | BLOCK — Cannot forward requests |
| Bridge | Sarathi (public key) | BLOCK — Cannot validate tokens |
| Bridge | Execution | FAIL — Cannot execute workloads |
| Execution | Bucket | FAIL — Cannot store artifacts |
| Execution | Sarathi (public key) | FAIL — Cannot verify bridge signature |

## Health Check Command

```bash
for port in 3000 3001 3002 3003 3004; do
  echo -n "Port $port: "
  curl -s --connect-timeout 2 http://localhost:$port/health | jq -r '.service // "DOWN"'
done
```

## Health Matrix (Operational States)

| State | Core | Sarathi | Bridge | Execution | Bucket | System Status |
|-------|------|---------|--------|-----------|--------|---------------|
| All healthy | ✅ | ✅ | ✅ | ✅ | ✅ | OPERATIONAL |
| Core down | ❌ | ✅ | ✅ | ✅ | ✅ | FAILED |
| Sarathi down | ✅ | ❌ | ❌(1) | ❌(1) | ✅ | BLOCKED — No tokens |
| Bridge down | ✅ | ✅ | ❌ | ✅ | ✅ | FAILED — No forwarding |
| Execution down | ✅ | ✅ | ✅ | ❌ | ✅ | FAILED — No execution |
| Bucket down | ✅ | ✅ | ✅ | ✅ | ❌ | FAILED — No storage |

(1) Bridge and Execution need Sarathi's public key for token validation
(2) All failures are HARD — no degraded mode, no fallback paths
