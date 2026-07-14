# TANTRA Gated Bridge — Extension Guidelines

**Version**: 1.0.0
**Date**: 2026-07-14

---

## 1. Overview

TANTRA Gated Bridge is designed for extension at well-defined attachment points. This guide documents how to extend the system without breaking its zero-trust guarantees.

### Principles

1. **Extensions must not bypass JWT validation** — all new services must validate tokens via JWKS
2. **Extensions must not create fallback paths** — hard-fail design is immutable
3. **Extensions must not modify the replay log format** — append-only, SHA-256 chain is immutable
4. **Extensions must be passive in observability** — telemetry events must always have `passive: true`

---

## 2. Extension Points

| # | Extension Point | Mechanism | Complexity |
|---|---|---|---|
| 1 | Custom Execution Participant | Environment variable + module export | Low |
| 2 | Custom Telemetry Consumer | File read of replay_log.jsonl | Low |
| 3 | Custom JWT Algorithm | Modify Sarathi + Bridge | High |
| 4 | New Service in Pipeline | Add to docker-compose + Core routing | High |
| 5 | Custom Observability Backend | Log forwarding (Logstash, Fluentd) | Low |
| 6 | Custom Bucket Storage | Replace SQLite adapter | Medium |

---

## 3. Extension 1: Custom Execution Participant

### Purpose

Replace the simulated workload (`setTimeout`) with real computation.

### Steps

1. Create a JavaScript module exporting `executeWorkload`:

```javascript
// my_participant.js
module.exports = {
  async executeWorkload(workload, trace_id, execution_id) {
    // Your custom logic here
    const result = await processWorkload(workload);
    return {
      workload,
      output: result,
      trace_id,
      execution_id
    };
  }
};
```

2. Set the environment variable in `services/execution/.env`:

```
EXECUTION_PARTICIPANT=./my_participant.js
```

3. Restart the Execution service.

### Contract

| Input | Type | Description |
|---|---|---|
| `workload` | string | Workload identifier or payload |
| `trace_id` | UUID | Immutable trace identifier |
| `execution_id` | UUID | Immutable execution identifier |

| Output | Type | Description |
|---|---|---|
| `workload` | string | Echoed workload identifier |
| `output` | any | Execution result |
| `trace_id` | UUID | Echoed trace identifier |
| `execution_id` | UUID | Echoed execution identifier |

### Constraints

- Must return within the request timeout (default: 30s)
- Must not make outbound HTTP calls to untrusted endpoints
- Must not modify trace_id or execution_id
- Must not generate JWT tokens

---

## 4. Extension 2: Custom Telemetry Consumer

### Purpose

Ingest TANTRA telemetry into external observability systems.

### Steps

1. Read `services/replay_persistence/data/replay_log.jsonl`
2. Parse each line as JSON
3. Filter by `event_type` prefix `telemetry:`
4. Forward to your observability backend

### Example (Node.js)

```javascript
const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, 'services/replay_persistence/data/replay_log.jsonl');

function getTelemetryEvents(since) {
  const raw = fs.readFileSync(LOG_PATH, 'utf-8');
  return raw.trim().split('\n')
    .map(line => JSON.parse(line))
    .filter(r => r.event_type?.startsWith('telemetry:'))
    .filter(r => !since || new Date(r.timestamp) > new Date(since));
}
```

### Constraints

- Read-only access to the replay log
- Must not modify the log file
- Must not block TANTRA service writes

---

## 5. Extension 3: New Service in Pipeline

### Purpose

Add a new service that participates in the TANTRA execution chain.

### Steps

1. Create a new directory under `services/` with `app.js`, `package.json`, `.env`, `.env.example`, `Dockerfile`
2. The new service must:
   - Validate JWT tokens via JWKS from Sarathi
   - Enforce trace_id/execution_id immutability
   - Forward to the next service in the chain
   - Emit passive telemetry events
3. Add the service to `services/docker-compose.yml`
4. Update Core routing to include the new service
5. Document the service in `docs/API.md`

### Constraints

- Must not sign JWT tokens (Sarathi authority only)
- Must not create fallback paths
- Must not store artifacts (Bucket authority only)
- Must validate JWT at every hop (zero-trust)
- Must emit telemetry with `passive: true`

---

## 6. Extension 4: Custom Bucket Storage

### Purpose

Replace SQLite with a different storage backend.

### Steps

1. Create a new storage adapter implementing:

```javascript
module.exports = {
  store(trace_id, execution_id, result) { /* ... */ },
  retrieve(trace_id, execution_id) { /* ... */ },
  verify(trace_id, execution_id) { /* ... */ }
};
```

2. Modify `services/bucket/app.js` to use the adapter
3. Update `services/bucket/.env` with storage configuration

### Constraints

- Must implement read-after-write verification
- Must compute SHA-256 hash of stored artifacts
- Must return `verified: true` on successful store
- Must propagate failures (no silent errors)

---

## 7. What Cannot Be Extended

| Property | Reason |
|---|---|
| JWT validation rules | Zero-trust enforcement is architectural |
| Bridge passivity | Constitutional boundary — Bridge has zero authority |
| Replay log format | SHA-256 chain integrity depends on fixed format |
| Hard-fail behaviour | No fallback paths by design |
| Trace immutability | trace_id/execution_id are immutable after generation |
| Observability passivity | Telemetry must never alter execution flow |

---

## 8. Testing Extensions

### Before Deploying

1. Run the convergence test suite:

```bash
cd services/bridge/tests && node convergence_test.js
```

2. Run the survivability test suite:

```bash
cd services/survivability_tests && node test_suite.js --proof
```

3. Verify chain integrity:

```bash
node -e "
const s = require('./services/replay_persistence/append_only_store');
const r = s.validateChainIntegrity();
console.log('Valid:', r.valid, '| Records:', r.record_count, '| Errors:', r.errors.length);
"
```

4. Run a full E2E workflow:

```bash
curl -X POST http://localhost:3000/initiate \
  -H "Content-Type: application/json" \
  -d '{"workload": "extension-test"}'
```

---

## References

| Document | Location |
|---|---|
| Capability Definition | `CAPABILITY_DEFINITION.md` |
| Attachment Guide | `docs/ATTACHMENT_GUIDE.md` |
| Constitutional Boundary | `tantra_gated_bridge/CONSTITUTIONAL_BOUNDARY_FINAL.md` |
| Ecosystem Contracts | `tantra_gated_bridge/docs/ECOSYSTEM_PARTICIPATION.md` |
| Known Limitations | `docs/KNOWN_LIMITATIONS.md` |
