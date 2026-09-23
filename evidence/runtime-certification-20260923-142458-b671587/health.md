# Runtime health evidence

Repository: `C:\Users\Ranjit\bhiv-Gurukul\TANTRA-Gated-Bridge-Infrastructure`
Commit: `b67158734ba874df4e4b25a27097cf2fd1405db6`
Run timestamp: `2026-09-23 14:24:58 +05:30`

Command: `docker compose ps`

All seven containers were running and healthy:

| Service | Port | HTTP result |
|---|---:|---|
| Core | 3000 | 200, `{"service":"core","status":"healthy"}` |
| Sarathi | 3001 | 200, healthy, issuer `tantra-sarathi`, RS256/EdDSA |
| Bridge | 3002 | 200, healthy, RS256/EdDSA |
| Execution | 3003 | 200, healthy, RS256/EdDSA |
| Bucket | 3004 | 200, healthy |
| InsightFlow | 3005 | 200, healthy |
| Redis | 6379 | Compose healthy |
