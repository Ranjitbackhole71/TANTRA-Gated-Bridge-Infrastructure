# TANTRA Recovery Guide

## Overview

This guide covers disaster recovery procedures for the TANTRA Gated Bridge platform. It addresses service failures, data loss scenarios, and full-system recovery.

## Recovery Scenarios

### Scenario 1: Single Service Failure

**Symptoms:** One service returns non-healthy status while others remain operational.

**Recovery:**
```bash
# Identify the failed service
docker ps --format "table {{.Names}}\t{{.Status}}"

# Restart the specific service
docker compose -f tantra_gated_bridge/deployment/docker-compose.yml restart <service-name>

# Verify recovery
curl http://localhost:<port>/health
```

**Service Ports:**
| Service | Port |
|---------|------|
| Core | 3000 |
| Sarathi | 3001 |
| Bridge | 3002 |
| Execution | 3003 |
| Bucket | 3004 |
| InsightFlow | 3005 |

### Scenario 2: Complete System Failure

**Symptoms:** All services down or unreachable.

**Recovery:**
```bash
# Full system restart
docker compose -f tantra_gated_bridge/deployment/docker-compose.yml down
docker compose -f tantra_gated_bridge/deployment/docker-compose.yml up -d --build

# Verify all services
$ports = @(3000, 3001, 3002, 3003, 3004, 3005)
foreach ($p in $ports) {
  try {
    $r = Invoke-RestMethod -Uri "http://localhost:$p/health" -TimeoutSec 5
    Write-Output "Port $p : $($r.status)"
  } catch {
    Write-Output "Port $p : FAILED"
  }
}
```

### Scenario 3: Sarathi Key Loss

**Symptoms:** JWT token generation fails, Bridge returns 401 for all requests.

**Recovery:**
Sarathi generates new RSA key pairs on startup. Restarting Sarathi will regenerate keys:
```bash
docker compose -f tantra_gated_bridge/deployment/docker-compose.yml restart sarathi
```

**Note:** Existing tokens signed with old keys will be rejected. Clients must re-authenticate.

### Scenario 4: Bucket Database Corruption

**Symptoms:** Artifact storage or retrieval fails, hash verification errors.

**Recovery:**
```bash
# Stop bucket service
docker compose -f tantra_gated_bridge/deployment/docker-compose.yml stop bucket

# Remove corrupted database (data will be lost)
docker volume rm deployment_bucket-data

# Restart bucket
docker compose -f tantra_gated_bridge/deployment/docker-compose.yml start bucket
```

**Prevention:** Bucket uses SQLite with write-ahead logging. Regular volume snapshots recommended.

### Scenario 5: Docker Network Partition

**Symptoms:** Services cannot communicate, inter-service requests timeout.

**Recovery:**
```bash
# Full teardown and rebuild
docker compose -f tantra_gated_bridge/deployment/docker-compose.yml down -v
docker compose -f tantra_gated_bridge/deployment/docker-compose.yml up -d --build
```

## Data Recovery

### Artifact Recovery

Bucket artifacts are stored in SQLite database (`bucket.db`). To export before recovery:
```bash
# Copy database out of container
docker cp deployment-bucket-1:/app/bucket.db ./bucket-backup.db
```

### Replay Chain Recovery

Replay persistence data is stored in the services directory. The append-only store maintains chain integrity. If chain is broken:
```bash
# Check chain integrity
node services/survivability_tests/test_suite.js
```

### InsightFlow Telemetry Recovery

Telemetry data is stored in JSONL format:
```bash
# Export telemetry data
docker cp deployment-insightflow-1:/app/data/insightflow_telemetry.jsonl ./telemetry-backup.jsonl
```

## Health Check Matrix

| Service | Health Endpoint | Expected Response | Timeout |
|---------|----------------|-------------------|---------|
| Core | GET /health | `{"service":"core","status":"healthy"}` | 5s |
| Sarathi | GET /health | `{"service":"sarathi","status":"healthy","issuer":"tantra-sarathi"}` | 5s |
| Bridge | GET /health | `{"service":"bridge","status":"healthy"}` | 5s |
| Execution | GET /health | `{"service":"execution","status":"healthy"}` | 5s |
| Bucket | GET /health | `{"service":"bucket","status":"healthy"}` | 5s |
| InsightFlow | GET /health | `{"service":"insightflow-local","status":"healthy","port":3005}` | 5s |

## Escalation

If recovery procedures fail:
1. Check Docker Desktop status and resources
2. Verify port availability (netstat)
3. Check Docker logs: `docker logs <container-name> --tail 50`
4. Full system rebuild from source
