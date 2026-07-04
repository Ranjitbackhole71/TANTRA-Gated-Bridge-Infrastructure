# TANTRA Operational Runbook

## Daily Operations

### Start Services

```bash
# Docker
bash scripts/start.sh docker

# Native
bash scripts/start.sh native
```

### Stop Services

```bash
# Docker
bash scripts/stop.sh docker

# Native
bash scripts/stop.sh native
```

### Verify Health

```bash
bash scripts/verify.sh
```

### Full Convergence Proof

```bash
bash scripts/convergence_proof.sh
```

## Monitoring

### Health Endpoints

| Service | Endpoint | Expected Response |
|---------|----------|-------------------|
| Core | GET /health | `{"service":"core","status":"healthy"}` |
| Sarathi | GET /health | `{"service":"sarathi","status":"healthy",...}` |
| Bridge | GET /health | `{"service":"bridge","status":"healthy",...}` |
| Execution | GET /health | `{"service":"execution","status":"healthy",...}` |
| Bucket | GET /health | `{"service":"bucket","status":"healthy"}` |
| InsightFlow | GET /health | `{"service":"insightflow-local","status":"healthy",...}` |

### Log Files

| Service | Location | Format |
|---------|----------|--------|
| Docker | `docker logs <container>` | JSON structured |
| Native | stdout/stderr | JSON structured |
| Replay | `services/replay_persistence/data/replay_log.jsonl` | JSONL |
| InsightFlow | `services/insightflow/data/insightflow_telemetry.jsonl` | JSONL |

### Log Structure

All services emit structured JSON logs:

```json
{
  "timestamp": "2026-01-01T00:00:00.000Z",
  "trace_id": "uuid",
  "execution_id": "uuid",
  "service_name": "service",
  "status": "info|error|success|warn",
  "message": "Log message"
}
```

## Troubleshooting

### Service Won't Start

**Symptoms**: Service exits immediately or fails to bind port

**Diagnosis**:
```bash
# Check port availability
netstat -an | grep -E '300[0-4]'

# Check Node.js version
node -v  # Requires 18+

# Check dependencies
cd services/core && npm install
```

**Resolution**:
1. Kill process on conflicting port
2. Upgrade Node.js to 18+
3. Reinstall dependencies

### Health Check Failing

**Symptoms**: Health endpoint returns non-healthy status

**Diagnosis**:
```bash
# Check service logs
docker logs aiaic-tantra-core

# Check network connectivity
docker network inspect aiaic-network

# Check dependency health
curl http://localhost:3001/health  # Sarathi
```

**Resolution**:
1. Restart the failing service
2. Check dependency availability
3. Verify network configuration

### JWT Validation Failing

**Symptoms**: 401 Unauthorized errors

**Diagnosis**:
```bash
# Check Sarathi health
curl http://localhost:3001/health

# Check JWKS endpoint
curl http://localhost:3001/.well-known/jwks.json

# Check key files
ls -la services/sarathi/keys/
```

**Resolution**:
1. Restart Sarathi to regenerate keys
2. Check key file permissions
3. Verify JWT algorithm matches

### Replay Detection Issues

**Symptoms**: Valid tokens rejected as replay

**Diagnosis**:
```bash
# Check replay log
cat services/replay_persistence/data/replay_log.jsonl | tail -20

# Verify chain integrity
node -e "const s = require('./services/replay_persistence/append_only_store'); console.log(s.validateChainIntegrity())"
```

**Resolution**:
1. Check for duplicate jti values
2. Verify replay store is writable
3. Restart services to clear in-memory cache

### Bucket Storage Issues

**Symptoms**: Artifacts not stored or retrieved

**Diagnosis**:
```bash
# Check Bucket health
curl http://localhost:3004/health

# Check SQLite database
sqlite3 services/bucket/bucket.db "SELECT COUNT(*) FROM artifacts;"

# Check disk space
df -h
```

**Resolution**:
1. Restart Bucket service
2. Check SQLite database integrity
3. Free disk space

### Execution Participant Failing

**Symptoms**: Execution returns 503

**Diagnosis**:
```bash
# Check Execution health
curl http://localhost:3003/health

# Check execution outputs
ls -la services/execution/outputs/

# Check custom participant
echo $EXECUTION_PARTICIPANT
```

**Resolution**:
1. Verify participant module exists
2. Check participant module syntax
3. Use default participant if custom fails

## Recovery Procedures

### Service Recovery

```bash
# Docker
docker restart <container-name>

# Native
# Kill and restart specific service
kill $(grep <port> tantra.pids)
cd services/<service> && node app.js &
```

### Full System Recovery

```bash
# Stop all services
bash scripts/stop.sh native

# Clear state (optional)
rm -rf services/replay_persistence/data/*
rm -f services/bucket/bucket.db

# Restart
bash scripts/start.sh native
```

### Key Recovery

```bash
# Keys are auto-generated on startup
# To manually regenerate:
rm -rf services/sarathi/keys/*
# Restart Sarathi service
```

### Database Recovery

```bash
# Backup
cp services/bucket/bucket.db services/bucket/bucket.db.backup

# Restore
cp services/bucket/bucket.db.backup services/bucket/bucket.db

# Or reset
rm services/bucket/bucket.db
# Restart Bucket service
```

## Performance Tuning

### Resource Limits (Docker)

```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 512M
    reservations:
      cpus: '0.5'
      memory: 256M
```

### Connection Pooling

- SQLite: Single connection (WAL mode)
- HTTP: Connection reuse via axios

### Caching

- JWKS: 5-minute cache (JWKS_CACHE_TTL_MS)
- Token cache: In-memory with TTL

## Security Operations

### Key Rotation

```bash
# Manual rotation
node -e "const kp = require('./services/sarathi/key_persistence'); console.log(kp.rotateKeys())"

# Verify rotation
cat services/sarathi/keys/key_meta.json
```

### Audit Logs

```bash
# Replay log (all token usage)
cat services/replay_persistence/data/replay_log.jsonl

# Filter by trace_id
grep '"trace_id":"<uuid>"' services/replay_persistence/data/replay_log.jsonl
```

### Security Checklist

- [ ] JWT keys stored with mode 0600
- [ ] No secrets in logs
- [ ] Docker runs as non-root
- [ ] Health checks enabled
- [ ] Resource limits configured
- [ ] Network isolation enabled

## Maintenance

### Backup

```bash
# Backup all data
tar -czf tantra-backup-$(date +%Y%m%d).tar.gz \
  services/sarathi/keys/ \
  services/replay_persistence/data/ \
  services/bucket/bucket.db \
  services/insightflow/data/
```

### Upgrade

```bash
# Pull latest code
git pull

# Rebuild Docker images
docker-compose build --no-cache

# Restart
docker-compose up -d
```

### Cleanup

```bash
# Docker cleanup
docker system prune -f

# Native cleanup
rm -rf services/*/node_modules
cd services/core && npm install
```

## Monitoring Queries

### Chain Integrity

```bash
node -e "
const s = require('./services/replay_persistence/append_only_store');
const r = s.validateChainIntegrity();
console.log('Valid:', r.valid);
console.log('Records:', r.record_count);
if (r.errors.length) console.log('Errors:', r.errors);
"
```

### Trace Reconstruction

```bash
node services/replay_reconstruction/reconstruction_tool.js <trace_id>
```

### Telemetry Summary

```bash
curl http://localhost:3005/telemetry/summary
```
