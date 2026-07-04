# TANTRA Known Limitations

## Architecture Limitations

### 1. Single-Instance Services
**Limitation:** Each service runs as a single container instance with no horizontal scaling.
**Impact:** No fault tolerance for individual service failures; no load balancing.
**Mitigation:** Docker Compose `restart: unless-stopped` policy auto-restarts failed containers.
**Future:** Consider Kubernetes deployment with replica sets for production.

### 2. SQLite for Bucket Storage
**Limitation:** Bucket uses SQLite, which is file-based and not suitable for multi-writer concurrent access.
**Impact:** Write contention under high concurrency; no distributed storage.
**Mitigation:** Single-writer pattern; artifact writes are sequential per execution.
**Future:** Migrate to PostgreSQL or distributed object storage for production scale.

### 3. No Authentication Between Services
**Limitation:** Inter-service communication within Docker network is unauthenticated.
**Impact:** Any container on the `tantra-network` can call any service directly.
**Mitigation:** Docker network isolation; services only expose ports internally.
**Future:** Implement mTLS or service mesh for zero-trust networking.

### 4. Static Key Pair for Sarathi
**Limitation:** RSA/EdDSA key pairs are regenerated on each container restart.
**Impact:** Existing tokens become invalid after Sarathi restart; clients must re-authenticate.
**Mitigation:** Key rotation is intentional for security; JWKS endpoint provides current keys.
**Future:** Persistent key storage with automated rotation schedule.

### 5. No Persistent Telemetry Storage
**Limitation:** InsightFlow stores telemetry in JSONL files, not a database.
**Impact:** Limited query performance; no indexing; no aggregation capabilities at scale.
**Mitigation:** Suitable for development and moderate workloads.
**Future:** Migrate to time-series database (InfluxDB, TimescaleDB).

## Security Limitations

### 6. JWT Token Expiry Not Enforced at Bridge
**Limitation:** Bridge validates signature and jti but does not strictly enforce expiry timestamps.
**Impact:** Expired tokens may be accepted if jti hasn't been used before.
**Mitigation:** Token expiry is set to 1 hour; jti tracking prevents replay.
**Future:** Add explicit expiry validation in Bridge middleware.

### 7. No Rate Limiting
**Limitation:** No rate limiting on any service endpoint.
**Impact:** Vulnerable to denial-of-service attacks.
**Mitigation:** Docker resource limits (CPU/memory) provide some protection.
**Future:** Implement API gateway with rate limiting.

### 8. No HTTPS/TLS
**Limitation:** All communication is over plain HTTP.
**Impact:** Data in transit is not encrypted.
**Mitigation:** Suitable for internal/Docker network; external access should use reverse proxy.
**Future:** Add TLS termination at load balancer or reverse proxy.

## Operational Limitations

### 9. No Automated Backups
**Limitation:** No built-in backup mechanism for Bucket database or InsightFlow telemetry.
**Impact:** Data loss possible on container/volume deletion.
**Mitigation:** Manual backup procedures documented in Maintenance Guide.
**Future:** Implement automated backup cron jobs.

### 10. No Health Check Alerting
**Limitation:** Health checks are manual; no automated alerting on service failures.
**Impact:** Service outages may go undetected.
**Mitigation:** Docker restart policy handles automatic recovery.
**Future:** Integrate with monitoring stack (Prometheus + Grafana).

### 11. No Distributed Tracing
**Limitation:** Trace IDs are propagated manually through headers; no OpenTelemetry integration.
**Impact:** Limited observability into cross-service latency and bottlenecks.
**Mituation:** Structured JSON logs with trace_id enable manual correlation.
**Future:** Add OpenTelemetry SDK for distributed tracing.

### 12. No Graceful Shutdown
**Limitation:** Services do not implement graceful shutdown handlers.
**Impact:** In-flight requests may be dropped during container stop.
**Mitigation:** Short request durations minimize impact.
**Future:** Handle SIGTERM signals for graceful connection draining.

## Development Limitations

### 13. No TypeScript
**Limitation:** All services are written in JavaScript without type definitions.
**Impact:** No compile-time type checking; potential runtime type errors.
**Mitigation:** JSDoc comments and test coverage provide some safety.
**Future:** Migrate to TypeScript for type safety.

### 14. Limited Test Coverage
**Limitation:** No unit tests for individual service functions; integration tests only.
**Impact:** Difficult to isolate failures to specific functions.
**Mitigation:** 99 tests covering integration scenarios pass successfully.
**Future:** Add unit tests for critical business logic.

### 15. No CI/CD Pipeline
**Limitation:** No automated build, test, or deployment pipeline.
**Impact:** Manual deployment process; risk of human error.
**Mitigation:** Docker Compose provides reproducible builds.
**Future:** Implement GitHub Actions or similar CI/CD pipeline.
