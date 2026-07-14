# TANTRA Gated Bridge — Compatibility Matrix

**Version**: 1.0.0
**Date**: 2026-07-14

---

## 1. Runtime Compatibility

### Node.js

| Version | Status | Notes |
|---|---|---|
| 18.x (LTS) | Supported | Primary runtime, all Dockerfiles use `node:18-alpine` |
| 20.x | Compatible | Not tested, but no incompatible APIs used |
| 16.x | Not Supported | `crypto.randomUUID()` requires Node 19+; fallback needed |

### npm

| Version | Status | Notes |
|---|---|---|
| 9.x | Supported | Bundled with Node 18 |
| 10.x | Supported | Bundled with Node 20 |

---

## 2. Operating System Compatibility

| OS | Status | Notes |
|---|---|---|
| Windows 10/11 | Supported | Primary development environment. PowerShell scripts (`.ps1`) and batch scripts (`.bat`) provided |
| Linux (Ubuntu, Debian, Alpine) | Supported | Shell scripts (`.sh`) provided. Docker images use `node:18-alpine` |
| macOS | Supported | Shell scripts work. No macOS-specific code |

### OS-Specific Scripts

| Script | Windows | Linux/macOS |
|---|---|---|
| `scripts/start.ps1` | Native | N/A |
| `scripts/start.sh` | WSL/Git Bash | Native |
| `scripts/verify.ps1` | Native | N/A |
| `scripts/verify.sh` | WSL/Git Bash | Native |
| `scripts/convergence_proof.ps1` | Native | N/A |
| `scripts/convergence_proof.sh` | WSL/Git Bash | Native |
| `scripts/stop.ps1` | Native | N/A |
| `scripts/stop.sh` | WSL/Git Bash | Native |

---

## 3. Docker Compatibility

| Component | Version | Status |
|---|---|---|
| Docker CLI | 20.10+ | Supported |
| Docker Compose V2 | 2.0+ | Supported (`docker compose` command) |
| Docker Compose V1 | 1.29+ | Supported (`docker-compose` command) |
| Docker Desktop | 4.x | Supported |
| Docker Engine (Linux) | 20.10+ | Supported |

### Base Image

| Image | Version | Purpose |
|---|---|---|
| `node` | `18-alpine` | All 5 TANTRA services |
| `node` | `18` | InsightFlow (if needed) |

---

## 4. Storage Compatibility

| Component | Version | Status | Notes |
|---|---|---|---|
| SQLite (better-sqlite3) | 9.x | Supported | Bucket artifact storage |
| SQLite (better-sqlite3) | 10.x+ | Compatible | No breaking API changes |
| Filesystem (JSONL) | Any | Supported | Replay persistence, append-only |
| Filesystem (PEM) | Any | Supported | Key storage |

---

## 5. Library Compatibility

### Core Dependencies (per service)

| Library | Version | Service | Purpose |
|---|---|---|---|
| express | 4.x | All | HTTP framework |
| jsonwebtoken | 9.x | Bridge, Execution, Sarathi | JWT verification |
| axios | 1.x | Core, Bridge, Execution | HTTP client |
| better-sqlite3 | 9.x | Bucket | SQLite storage |
| crypto | built-in | All | UUID generation, SHA-256 hashing |

### Python Dependencies (Setu)

| Library | Version | Purpose |
|---|---|---|
| fastapi | 0.100+ | Setu web framework |
| uvicorn | 0.20+ | ASGI server |
| httpx | 0.24+ | HTTP client |

### Python Dependencies (Runtime/Platform)

| Library | Version | Purpose |
|---|---|---|
| pyyaml | 6.x | Configuration |
| pytest | 7.x+ | Testing |

---

## 6. Ecosystem Consumer Compatibility

### Compatible (Pull-Based Integration)

| System | Integration Method | Notes |
|---|---|---|
| Logstash | JSONL file input | Read `replay_log.jsonl` directly |
| Elasticsearch | JSONL ingestion | Via Logstash or Filebeat |
| Fluentd | `in_tail` plugin | Tail JSONL file |
| Loki | Promtail scraping | JSONL scraping |
| Grafana | Via Loki | LogQL queries on telemetry events |
| Datadog | Agent log tailing | Tail JSONL file |
| Splunk | Universal Forwarder | Monitor JSONL file |

### Not Compatible (Requires Extension)

| System | Reason |
|---|---|
| Istio / Linkerd (Service Mesh) | No sidecar injection configured |
| Jaeger / Zipkin (Distributed Tracing) | No trace context propagation headers (`traceparent`, ` baggage`) |
| Kafka / NATS (Message Queues) | No built-in producer integration |
| Open Policy Agent (Governance) | No policy decision points exposed |
| Prometheus (Metrics) | No `/metrics` endpoint |

---

## 7. API Consumer Compatibility

| Consumer Type | Protocol | Authentication | Status |
|---|---|---|---|
| HTTP clients (curl, Postman) | HTTP/1.1 | None (internal) | Supported |
| Node.js (axios/fetch) | HTTP/1.1 | JWT Bearer token | Supported |
| Python (httpx/requests) | HTTP/1.1 | JWT Bearer token | Supported |
| Setu (FastAPI) | HTTP/1.1 | Internal network | Supported |
| Kubernetes (liveness/readiness) | HTTP/1.1 | None | Supported (port mapping) |

---

## 8. Security Compatibility

| Feature | Status | Notes |
|---|---|---|
| JWT RS256 | Supported | Default algorithm |
| JWT EdDSA | Supported | Ed25519 keys |
| JWKS (RFC 7517) | Supported | `/.well-known/jwks.json` |
| kid-based key resolution | Supported | JWT header `kid` field |
| mTLS | Not Supported | HTTP only; add reverse proxy for TLS |
| OAuth 2.0 / OIDC | Not Supported | No OIDC discovery endpoint |
| HSM key storage | Not Supported | File-based keys only |

---

## References

| Document | Location |
|---|---|
| Known Limitations | `docs/KNOWN_LIMITATIONS.md` |
| Architecture | `docs/ARCHITECTURE.md` |
| Ecosystem Alignment | `tantra_gated_bridge/ECOSYSTEM_ALIGNMENT_NOTE.md` |
| Ecosystem Contracts | `tantra_gated_bridge/docs/ECOSYSTEM_PARTICIPATION.md` |
