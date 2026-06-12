# Execution Service Contract

## Identity
- **Service**: Execution
- **Port**: 3003
- **Role**: External workload execution with replay-safe integrity

## API

### POST /run
Executes a workload and stores result in Bucket.

**Request**:
```json
{
  "workload": "string",
  "trace_id": "uuid",
  "execution_id": "uuid",
  "bridge_signature": "Bearer <jwt>"
}
```

**Response (200)**:
```json
{
  "trace_id": "uuid",
  "execution_id": "uuid",
  "status": "completed",
  "result": { ... },
  "artifact_location": "artifacts/<trace_id>/<execution_id>",
  "duration_ms": 100
}
```

**Response (401)**: Invalid bridge signature
**Response (503)**: Bucket unavailable

### GET /health
```json
{ "service": "execution", "status": "healthy" }
```

## Execution Participant Interface

Execution uses an adapter pattern. The `executeWorkload` function is swappable:

```
executeWorkload(workload, trace_id, execution_id) → { workload, output, trace_id, execution_id }
```

### Provided Adapters

| Adapter | File | Status |
|---------|------|--------|
| Simulated | `app.js:148-160` | DEFAULT — setTimeout placeholder |
| Contract | `execution_participant.js` | REAL — file-system based execution |

### Custom Participant

Create any module exporting:
```js
module.exports = async function execute(workload, trace_id, execution_id) {
  // real execution logic here
  return { workload, output, trace_id, execution_id };
};
```

Set `EXECUTION_PARTICIPANT=./path/to/participant.js` to override.

## Replay-Safe Guarantees

1. Every execution generates a SHA-256 hash chain record in replay log
2. All output is stored in Bucket with read-after-write verification
3. trace_id and execution_id are immutable across all services
4. Deterministic: same inputs produce identical reconstruction

## Immutable Trace Continuity

```
Core → generates trace_id + execution_id
  → Sarathi → signs JWT with trace_id + execution_id
    → Bridge → validates JWT, enforces immutability
      → Execution → validates bridge signature, executes, stores in Bucket
        → Bucket → read-after-write verify, SHA-256 hash stored
```

Proof: LIVE_EXECUTION_PROOF.md
