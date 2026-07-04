# TANTRA Maintenance Guide

## Routine Maintenance

### Daily

1. **Health Check Verification**
   ```bash
   # PowerShell
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

2. **Log Rotation Check**
   - Docker logs are auto-rotated by Docker daemon
   - Verify no excessive disk usage: `docker system df`

### Weekly

1. **Docker Image Updates**
   ```bash
   # Pull latest base images
   docker compose -f tantra_gated_bridge/deployment/docker-compose.yml pull

   # Rebuild with updated images
   docker compose -f tantra_gated_bridge/deployment/docker-compose.yml up -d --build
   ```

2. **Database Maintenance**
   - Check Bucket SQLite database size
   - Verify replay chain integrity: `node services/survivability_tests/test_suite.js`

3. **Security Scan**
   ```bash
   # Scan for vulnerable dependencies
   cd services/core && npm audit
   cd services/bridge && npm audit
   cd services/execution && npm audit
   cd services/bucket && npm audit
   cd services/sarathi && npm audit
   cd services/insightflow && npm audit
   ```

### Monthly

1. **Key Rotation (Sarathi)**
   - Sarathi generates new RSA key pairs on restart
   - Schedule monthly restart during maintenance window
   ```bash
   docker compose -f tantra_gated_bridge/deployment/docker-compose.yml restart sarathi
   ```

2. **Full Rebuild**
   ```bash
   docker compose -f tantra_gated_bridge/deployment/docker-compose.yml down
   docker system prune -f
   docker compose -f tantra_gated_bridge/deployment/docker-compose.yml up -d --build
   ```

3. **Test Suite Execution**
   ```bash
   # Python platform tests
   python -m pytest tests/platform_tests -v

   # Survivability tests
   cd services && node survivability_tests/test_suite.js

   # Bridge convergence tests
   cd services && node bridge/tests/convergence_test.js
   ```

## Service-Specific Maintenance

### Core Service
- No persistent state; safe to restart anytime
- Environment variables: `PORT`, `SARATHI_URL`, `BRIDGE_URL`

### Sarathi Service
- Generates RSA keys on startup (stored in Docker volume `sarathi-keys`)
- Key rotation occurs on container restart
- Volume backup: `docker cp deployment-sarathi-1:/app/keys ./sarathi-keys-backup`

### Bridge Service
- No persistent state; safe to restart anytime
- Validates JWT tokens; depends on Sarathi for key resolution
- Environment variables: `PORT`, `SARATHI_URL`, `EXECUTION_URL`

### Execution Service
- No persistent state; safe to restart anytime
- Processes workloads; depends on Sarathi and Bucket
- Environment variables: `PORT`, `SARATHI_URL`, `BUCKET_URL`

### Bucket Service
- **Persistent state:** SQLite database (`bucket.db`)
- Data stored in Docker volume `bucket-data`
- Volume backup: `docker cp deployment-bucket-1:/app/bucket.db ./bucket-backup.db`
- DO NOT restart during active writes

### InsightFlow
- **Persistent state:** Telemetry JSONL file
- Data stored in Docker volume `insightflow-data`
- Volume backup: `docker cp deployment-insightflow-1:/app/data ./insightflow-backup`

## Resource Monitoring

### Docker Resource Usage
```bash
# Check container resource usage
docker stats --no-stream

# Check disk usage
docker system df
```

### Expected Resource Limits
| Service | CPU Limit | Memory Limit |
|---------|-----------|--------------|
| Core | 0.5 CPU | 256MB |
| Sarathi | 0.5 CPU | 256MB |
| Bridge | 0.5 CPU | 256MB |
| Execution | 0.5 CPU | 256MB |
| Bucket | 0.5 CPU | 256MB |
| InsightFlow | 0.5 CPU | 256MB |
| **Total** | **3.0 CPU** | **1.5GB** |

## Backup Procedures

### Complete Backup
```bash
# Stop all services
docker compose -f tantra_gated_bridge/deployment/docker-compose.yml down

# Backup all volumes
docker run --rm -v deployment_bucket-data:/data -v $(pwd):/backup alpine tar czf /backup/bucket-data.tar.gz -C /data .
docker run --rm -v deployment_sarathi-keys:/data -v $(pwd):/backup alpine tar czf /backup/sarathi-keys.tar.gz -C /data .
docker run --rm -v deployment_insightflow-data:/data -v $(pwd):/backup alpine tar czf /backup/insightflow-data.tar.gz -C /data .

# Backup source code
tar czf backup-source.tar.gz services/ docs/ tests/ scripts/ docker-compose.yml
```

### Restore
```bash
# Restore volumes
docker run --rm -v deployment_bucket-data:/data -v $(pwd):/backup alpine tar xzf /backup/bucket-data.tar.gz -C /data

# Start services
docker compose -f tantra_gated_bridge/deployment/docker-compose.yml up -d
```

## Version Upgrades

1. Pull latest code from repository
2. Review CHANGELOG for breaking changes
3. Backup current data (see Backup Procedures)
4. Rebuild and deploy: `docker compose up -d --build`
5. Run full test suite to verify
6. Monitor health endpoints for 15 minutes
