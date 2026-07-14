# TANTRA Gated Bridge — Custodian Documentation

**Version**: 1.0.0
**Date**: 2026-07-14

---

## 1. Ownership

| Component | Owner | Repository Location |
|---|---|---|
| Core Service | TANTRA Platform Team | `services/core/` |
| Sarathi (JWT Authority) | TANTRA Platform Team | `services/sarathi/` |
| Bridge (Passive Forwarder) | TANTRA Platform Team | `services/bridge/` |
| Execution (Workload) | TANTRA Platform Team | `services/execution/` |
| Bucket (Storage) | TANTRA Platform Team | `services/bucket/` |
| InsightFlow Adapter | TANTRA Platform Team | `services/insightflow/` |
| Replay Persistence | TANTRA Platform Team | `services/replay_persistence/` |
| Replay Reconstruction | TANTRA Platform Team | `services/replay_reconstruction/` |
| Observability | TANTRA Platform Team | `services/observability/` |
| Survivability Tests | TANTRA Platform Team | `services/survivability_tests/` |
| Documentation | TANTRA Platform Team | `docs/` |
| Deployment | TANTRA Platform Team | `deployment/`, `scripts/` |
| Setu (User Product) | TANTRA Platform Team | `setu/` |

---

## 2. Maintenance Responsibilities

### Daily

| Task | Owner | Tool |
|---|---|---|
| Monitor service health | Operations | `scripts/verify.sh` |
| Review replay chain integrity | Operations | `node -e "require('./services/replay_persistence/append_only_store').validateChainIntegrity()"` |

### Weekly

| Task | Owner | Tool |
|---|---|---|
| Run full test suite | Engineering | `node services/bridge/tests/convergence_test.js` |
| Review replay log size | Operations | `wc -l services/replay_persistence/data/replay_log.jsonl` |

### Monthly

| Task | Owner | Tool |
|---|---|---|
| Run survivability tests | Engineering | `node services/survivability_tests/test_suite.js --proof` |
| Review known limitations | Engineering | `docs/KNOWN_LIMITATIONS.md` |
| Dependency audit | Security | `npm audit` per service |

### On Release

| Task | Owner | Tool |
|---|---|---|
| Update VERSION in CAPABILITY_DEFINITION.md | Release Manager | Manual |
| Update REVIEW_PACKET.md | Release Manager | Manual |
| Tag release in git | Release Manager | `git tag v{version}` |
| Verify Docker build | Release Manager | `docker compose build` |

---

## 3. Upgrade Process

### Minor Version Upgrade (e.g., 1.0.0 → 1.1.0)

1. Review CHANGELOG for new features
2. Pull latest code: `git pull origin master`
3. Run `npm install` in each service directory (or `docker compose build`)
4. Run test suite: `node services/bridge/tests/convergence_test.js`
5. Verify health: `scripts/verify.sh`
6. No data migration required

### Major Version Upgrade (e.g., 1.x → 2.0.0)

1. Review BREAKING CHANGES in CHANGELOG
2. Review API contract changes in `docs/API.md`
3. Check JWT claim changes (may require token format update)
4. Check replay log format changes (may require log migration)
5. Backup replay log: `cp services/replay_persistence/data/replay_log.jsonl backup/`
6. Backup bucket database: `cp services/bucket/bucket.db backup/`
7. Backup keys: `cp -r services/sarathi/keys/ backup/`
8. Pull latest code and run full test suite
9. Verify chain integrity post-upgrade

---

## 4. Dependency Map

### Node.js Services

```
Core (:3000)
  └── depends on → Sarathi (:3001) [JWT token request]
  └── depends on → Bridge (:3002) [forward workload]

Sarathi (:3001)
  └── depends on → nothing (self-contained, key persistence)

Bridge (:3002)
  └── depends on → Sarathi (:3001) [JWKS fetch]
  └── depends on → Execution (:3003) [forward workload]

Execution (:3003)
  └── depends on → Sarathi (:3001) [JWKS fetch for bridge signature]
  └── depends on → Bucket (:3004) [store artifact]

Bucket (:3004)
  └── depends on → nothing (self-contained, SQLite)

InsightFlow (:3005)
  └── depends on → nothing (passive receiver)
```

### Startup Order

```
1. Sarathi (provides JWKS)
2. Bucket (must be available before Execution)
3. Execution
4. Bridge
5. Core (last — depends on all others)
6. InsightFlow (optional, independent)
```

### npm Dependencies (per service)

| Service | Key Dependencies |
|---|---|
| Core | express, axios, crypto (built-in) |
| Sarathi | express, jsonwebtoken, crypto (built-in), fs |
| Bridge | express, axios, jsonwebtoken, crypto (built-in) |
| Execution | express, axios, jsonwebtoken, better-sqlite3 |
| Bucket | express, better-sqlite3, crypto (built-in) |

---

## 5. Onboarding Guide

### For New Engineers

1. Read `README.md` — system overview and quick start
2. Read `docs/ARCHITECTURE.md` — topology, security model, data flow
3. Read `docs/API.md` — all endpoints and schemas
4. Read `FINAL_HANDOVER_PACKET.md` — deployment, recovery, runtime flow
5. Read `CODE_PACKET.md` — code navigation and architecture walkthrough
6. Run `scripts/start.ps1` — start all services natively
7. Run `scripts/verify.ps1` — verify all services healthy
8. Submit a test workload: `curl -X POST http://localhost:3000/initiate -H "Content-Type: application/json" -d '{"workload":"hello"}'`
9. Run the convergence test: `cd services/bridge/tests && node convergence_test.js`

### Key Files to Understand

| File | Lines | Purpose |
|---|---|---|
| `services/core/app.js` | ~115 | Entry point, UUID generation, flow initiation |
| `services/sarathi/app.js` | ~172 | JWT authority, JWKS endpoint, key loading |
| `services/bridge/app.js` | ~275 | JWT validation, JWKS kid resolution, replay detection, immutability enforcement |
| `services/execution/app.js` | ~242 | Workload execution, bridge signature verification |
| `services/bucket/app.js` | ~202 | SQLite storage, read-after-write verification |
| `services/sarathi/key_persistence.js` | ~105 | Key generation, loading, rotation |
| `services/replay_persistence/append_only_store.js` | ~132 | Append-only log, SHA-256 chain |
| `services/replay_persistence/jti_store.js` | ~50 | Durable JTI persistence |

---

## 6. Extension Process

See `docs/EXTENSION_GUIDELINES.md` for the full extension guide.

### Summary

| Extension Type | Complexity | Key Constraint |
|---|---|---|
| Custom Execution Participant | Low | Module export, env var |
| Custom Telemetry Consumer | Low | File read, no modification |
| New Pipeline Service | High | JWT validation, zero-trust |
| Custom Bucket Storage | Medium | Read-after-write, SHA-256 |

---

## 7. Version History

| Version | Date | Summary |
|---|---|---|
| 1.0.0 | 2026-07-07 | Initial release. 6 services, 99/99 tests, full documentation. |

---

## 8. Known Limitations

| # | Limitation | Severity | Mitigation |
|---|---|---|---|
| 1 | Execution workload is simulated | Medium | Set `EXECUTION_PARTICIPANT` env var |
| 2 | InsightFlow is local only | Medium | Set `INSIGHTFLOW_URL` for remote |
| 3 | Replay cache is in-memory | Medium | `warmJtiCache()` on restart |
| 4 | No cross-node replication | Medium | Use shared storage or log aggregation |
| 5 | No automatic key rotation | Low | Manual via `key_persistence.rotateKeys()` |
| 6 | No mTLS | Low | Add reverse proxy for TLS |
| 7 | No secrets manager | Low | Use Vault/AWS Secrets Manager for production |
| 8 | Single-instance services | Low | Docker restart policy handles recovery |
| 9 | No rate limiting | Low | Docker resource limits |
| 10 | No CI/CD pipeline | Low | Manual verification via scripts |

---

## 9. Escalation Paths

| Issue | First Responder | Escalation |
|---|---|---|
| Service down | Operations | Restart via `scripts/start.ps1` |
| Chain integrity failure | Engineering | Run `corruption_detector.js`, review replay log |
| JWT validation failure | Security | Check JWKS endpoint, verify key rotation |
| Bucket data loss | Engineering | Restore from backup, verify hash chain |
| Replay log corruption | Engineering | Isolate corrupted records, rebuild from surviving data |

---

## References

| Document | Location |
|---|---|
| Handover Packet | `FINAL_HANDOVER_PACKET.md` |
| Architecture | `docs/ARCHITECTURE.md` |
| Recovery Guide | `docs/RECOVERY_GUIDE.md` |
| Maintenance Guide | `docs/MAINTENANCE_GUIDE.md` |
| Operational Runbook | `docs/OPERATIONAL_RUNBOOK.md` |
| Extension Guidelines | `docs/EXTENSION_GUIDELINES.md` |
