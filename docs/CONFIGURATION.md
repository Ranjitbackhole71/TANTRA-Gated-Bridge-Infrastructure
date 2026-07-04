# TANTRA Configuration Guide

## Overview

TANTRA uses environment variables for configuration. Copy `.env.example` to `.env` and customize.

## Environment Variables

### Platform Runtime

| Variable | Default | Description |
|----------|---------|-------------|
| AIAIC_ENV | development | Environment (development/staging/production) |
| AIAIC_PORT | 8000 | Gateway port |
| AIAIC_HOST | 0.0.0.0 | Gateway host |
| AIAIC_WORKERS | 2 | Number of workers |
| AIAIC_DEBUG | false | Debug mode |
| AIAIC_LOG_LEVEL | INFO | Log level |
| AIAIC_METRICS_ENABLED | true | Enable metrics |
| AIAIC_HEALTH_CHECK_INTERVAL | 30 | Health check interval (seconds) |

### Redis

| Variable | Default | Description |
|----------|---------|-------------|
| REDIS_URL | redis://localhost:6379/0 | Redis connection URL |
| REDIS_PORT | 6379 | Redis port |

### TANTRA Core

| Variable | Default | Description |
|----------|---------|-------------|
| TANTRA_CORE_PORT | 3000 | Core service port |
| SARATHI_URL | http://localhost:3001 | Sarathi service URL |
| BRIDGE_URL | http://localhost:3002 | Bridge service URL |

### TANTRA Sarathi

| Variable | Default | Description |
|----------|---------|-------------|
| TANTRA_SARATHI_PORT | 3001 | Sarathi service port |
| ISSUER | tantra-sarathi | JWT issuer |
| JWT_EXPIRY | 1h | JWT expiry time |
| JWT_EXPIRY_MS | 3600000 | JWT expiry in milliseconds |
| SARATHI_KEY_DIR | ./sarathi/keys | Key storage directory |

### TANTRA Bridge

| Variable | Default | Description |
|----------|---------|-------------|
| TANTRA_BRIDGE_PORT | 3002 | Bridge service port |
| EXECUTION_URL | http://localhost:3003 | Execution service URL |
| JWKS_CACHE_TTL_MS | 300000 | JWKS cache TTL (5 minutes) |

### TANTRA Execution

| Variable | Default | Description |
|----------|---------|-------------|
| TANTRA_EXECUTION_PORT | 3003 | Execution service port |
| BUCKET_URL | http://localhost:3004 | Bucket service URL |
| EXECUTION_PARTICIPANT | (none) | Custom execution participant module path |
| EXECUTION_OUTPUT_DIR | ./execution/outputs | Execution output directory |

### TANTRA Bucket

| Variable | Default | Description |
|----------|---------|-------------|
| TANTRA_BUCKET_PORT | 3004 | Bucket service port |

### Replay Persistence

| Variable | Default | Description |
|----------|---------|-------------|
| REPLAY_STORAGE_DIR | ./replay_persistence/data | Replay log directory |

### InsightFlow

| Variable | Default | Description |
|----------|---------|-------------|
| INSIGHTFLOW_URL | (none) | InsightFlow endpoint URL |
| INSIGHTFLOW_API_KEY | (none) | InsightFlow API key |
| INSIGHTFLOW_ENABLED | false | Enable InsightFlow forwarding |
| INSIGHTFLOW_PORT | 3005 | Local receiver port |
| INSIGHTFLOW_DATA_DIR | ./insightflow/data | Local receiver data directory |

### Gateway

| Variable | Default | Description |
|----------|---------|-------------|
| AIAIC_GATEWAY_PORT | 8000 | Gateway port |

### Security

| Variable | Default | Description |
|----------|---------|-------------|
| JWT_SECRET | your-secret-key-here | JWT secret (legacy, not used with RS256/EdDSA) |
| JWT_ALGORITHM | HS256 | JWT algorithm (legacy) |

## Docker Compose Configuration

### Root docker-compose.yml

Full stack deployment with:
- Gateway (Python/FastAPI)
- Redis
- All TANTRA services
- Health checks
- Resource limits
- Named volumes

### Services docker-compose.yml

TANTRA-only deployment:
- All TANTRA services
- InsightFlow
- Health checks
- Named volumes

## Configuration Files

### YAML Configuration

Located in `config/` directory:
- `base.yaml` — Base configuration
- `development.yaml` — Development overrides
- `staging.yaml` — Staging overrides
- `production.yaml` — Production overrides

**Note**: These are used by the Python gateway, not the Node.js TANTRA services.

### Key Persistence

Located in `services/sarathi/keys/`:
- `private.pem` — RSA private key
- `public.pem` — RSA public key
- `ed25519_private.pem` — Ed25519 private key
- `ed25519_public.pem` — Ed25519 public key
- `key_meta.json` — Key metadata and rotation state

## Security Considerations

### JWT Keys

- Keys are auto-generated on first startup
- Stored with mode 0600 (owner read/write only)
- Rotation supported via `rotateKeys()` function
- Previous keys archived during rotation

### Database

- SQLite database stored locally
- No network access required
- File permissions should be restricted

### Docker

- Non-root user in containers
- Resource limits configured
- Health checks enabled
- Named volumes for persistence

## Environment-Specific Configuration

### Development

```bash
AIAIC_ENV=development
AIAIC_DEBUG=true
AIAIC_LOG_LEVEL=DEBUG
```

### Production

```bash
AIAIC_ENV=production
AIAIC_DEBUG=false
AIAIC_LOG_LEVEL=INFO
AIAIC_WORKERS=4
```

## Validation

### Validate Configuration

```bash
# Check environment variables
node -e "require('dotenv').config(); console.log(process.env)"

# Check key files
ls -la services/sarathi/keys/

# Check database
sqlite3 services/bucket/bucket.db ".tables"
```
