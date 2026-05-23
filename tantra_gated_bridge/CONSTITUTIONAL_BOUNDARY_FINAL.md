# TANTRA Gated Bridge — Constitutional Boundary Final

## 1. Authority Declaration

### Authority OWNED by TANTRA Gated Bridge

| Authority | Owning Module | Constraints |
|---|---|---|
| JWT token generation | `sarathi/app.js` | RS256-signed, jti replay protection, 1h expiry |
| JWT validation + forwarding | `bridge/app.js` | Issuer/audience/signature verification only |
| Workload execution | `execution/app.js` | Simulated with 100ms delay; production swap required |
| Artifact storage + retrieval | `bucket/app.js` | SQLite with read-after-write verification |
| Trace ID generation | `core/app.js` | crypto.randomUUID(), immutable after creation |
| Execution ID generation | `core/app.js` | crypto.randomUUID(), immutable after creation |
| Append-only log writing | `replay_persistence/append_only_store.js` | SHA-256 hash chained, sequence monotonic |
| Trace reconstruction | `replay_reconstruction/reconstruction_tool.js` | Read-only, zero file modification |
| Chain integrity validation | `replay_persistence/append_only_store.js` | SHA-256 recompute, parent_hash verify |
| Corruption detection | `replay_reconstruction/corruption_detector.js` | Read-only, severity-classified findings |

### Authority NOT OWNED by TANTRA Gated Bridge

| Authority | Owner | Notes |
|---|---|---|
| Cross-node log replication | External (Logstash/Fluentd/Elastic) | Not built — intentional boundary |
| Distributed idempotency | External (Redis/DB) | Not built — in-memory only |
| Real-time observability streaming | External (Kafka/NATS) | Not built — file-based only |
| Governance/enforcement | External (Policy engine) | Not built — zero governance logic |
| Autonomous recovery | External (Orchestrator/K8s) | Not built — hard-fail design |
| Multi-node consensus | External (Raft/Paxos) | Not built — single-node deployment |
| Encryption at rest | External (LUKS/BitLocker) | Not built — plaintext files |
| Authentication/Authorization | Sarathi (JWT) | Bridge validates, does not issue |

## 2. Persistence Boundaries

### Replay Log (`replay_persistence/data/replay_log.jsonl`)

| Property | Value |
|---|---|
| Storage | Local filesystem |
| Format | JSONL (append-only) |
| Access | Synchronous file I/O |
| Encryption | None (plaintext) |
| Retention | Unlimited (no TTL) |
| Cross-node | None (local only) |

**Boundary**: The replay log is append-only by construction. No module can DELETE, UPDATE, or TRUNCATE the log. The `appendRecord()` function only appends. The `validateChainIntegrity()` function only reads.

### Bucket Database (`services/bucket/bucket.db`)

| Property | Value |
|---|---|
| Storage | SQLite file |
| Format | SQLite B-tree |
| Access | better-sqlite3 synchronous |
| Encryption | None |
| Retention | Unlimited |

**Boundary**: Bucket stores execution artifacts only. It does not store tokens, keys, or runtime state.

## 3. Observability Limits

| Limit | Detail |
|---|---|
| No real-time streaming | All events written synchronously to disk |
| No push-based alerting | No webhook, no email, no alert rules |
| No live dashboard | No built-in UI or charting |
| No metric aggregation | Individual events only, no rollups |
| No distributed tracing headers | trace: events are emitted but not propagated via HTTP |

## 4. Governance Exclusions

The TANTRA Gated Bridge explicitly excludes:

- **Autonomous decision logic**: No module makes decisions based on replay analysis
- **Policy enforcement**: No module blocks execution based on telemetry
- **Orchestration authority**: No module can start/stop other modules
- **State mutation based on observation**: Telemetry never modifies execution flow
- **Recovery automation**: No module auto-restarts failed services
- **Load balancing**: No module distributes work across nodes

## 5. Replay Limits

| Limit | Detail |
|---|---|
| Single-node only | replay_log.jsonl exists on one filesystem |
| No log shipping | No built-in mechanism to forward logs |
| No log rotation | File grows unbounded |
| No archival policy | All records kept forever |
| No cross-process locking | Concurrent writes from same process only |

## 6. Distributed Gaps

| Gap | Severity | Workaround |
|---|---|---|
| No multi-node deployment tested | Medium | docker-compose can scale individual services |
| No distributed consensus | Low | Single-writer pattern sufficient for current scope |
| No cross-node trace correlation | Medium | Manual log aggregation required |
| No health check routing | Low | All services exposed directly on mapped ports |
| No service discovery | Low | Docker Compose DNS resolution |
| No secret rotation | Low | Keys generated on first start, static after |

## 7. Constitutional Summary

```
TANTRA Gated Bridge is:
  - A zero-trust, hard-fail execution pipeline
  - With passive append-only replay observability
  - And read-only reconstruction tooling
  - With zero governance, zero orchestration, zero autonomous logic
  - Deployable as a single Docker Compose stack
  - Verifiable via chain integrity and deterministic replay
```

All boundaries documented in this file are subject to automated verification via the `verify_full_stack.sh` / `verify_full_stack.ps1` scripts.
