# TANTRA Gated Bridge — Observability Contract

## Declaration

This contract defines the passive observability boundary of the TANTRA Gated Bridge system. All observability modules operate under strict passive-only constraints. No telemetry or trace collection logic has any execution authority.

## 1. Passive Guarantee

All observability events MUST satisfy:

```
payload.telemetry === true
payload.passive  === true
```

These flags enable automated verification that no observability event was elevated to an active role. A downstream consumer can reject any event lacking these flags.

## 2. Observability Module Boundaries

### 2.1 telemetry_emitter.js

**Authority**: Emit only. No middleware. No response modification. No service calls.

**Permitted operations**:
- Read trace_id, execution_id from caller
- Call store.appendRecord() with telemetry-prefixed events
- Return record to caller

**Forbidden operations**:
- Register Express middleware
- Modify request/response objects
- Make HTTP/axios calls
- Access service state
- Make routing decisions

### 2.2 trace_collector.js

**Authority**: Emit only. No span propagation. No context injection.

**Permitted operations**:
- Generate span_id (UUID v4)
- Emit trace: prefixed records to append-only store
- Return span count summary

**Forbidden operations**:
- Inject trace context into HTTP headers
- Modify request objects
- Propagate spans across service boundaries
- Register middleware

### 2.3 replay_hooks.js

**Authority**: Callback wrappers only. No automatic registration.

**Permitted operations**:
- Wrap explicit function calls with telemetry emission
- Return results to caller

**Forbidden operations**:
- Automatically register hooks
- Intercept requests
- Modify execution flow

## 3. Schema Compliance

All observability events MUST conform to `observability/schema.json`. The schema defines:

### 3.1 telemetry_base
- trace_id (uuid, required)
- execution_id (uuid|null)
- event_type (pattern: ^telemetry:)
- service (string)
- status (string)
- payload (object, required: telemetry, passive)
- timestamp (ISO 8601)
- parent_hash (sha256|null)
- sequence (integer)
- hash (sha256)
- host (string)

### 3.2 Supported Event Types

| event_type | payload stub |
|---|---|
| telemetry:request_received | { method, path, has_token } |
| telemetry:execution_transition | { from_status } |
| telemetry:rejection | { rejection_reason } |
| telemetry:dependency_failure | { failed_dependency, error_message } |
| telemetry:response_sent | { status, result } |
| telemetry:replay_verification | { verification_id, outcome } |

## 4. Verification

Run the following to verify observability contract compliance:

```bash
node -e "
const allRecords = require('./services/replay_persistence/append_only_store').getAllRecords();
const telem = allRecords.filter(r => r.event_type?.startsWith('telemetry:'));
const violations = telem.filter(r => r.payload?.passive !== true);
console.log('Telemetry events:', telem.length);
console.log('Passive violations:', violations.length);
console.log('Contract:', violations.length === 0 ? 'ACTIVE' : 'BROKEN');
"
```

## 5. Commitment

This observability contract is immutable. No future modification shall:
- Grant execution authority to observability modules
- Remove passive:true tags
- Add middleware registration to observability code
- Enable autonomous decision-making based on telemetry data
