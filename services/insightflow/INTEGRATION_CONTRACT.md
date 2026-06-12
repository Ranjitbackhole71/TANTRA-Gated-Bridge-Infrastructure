# InsightFlow Integration Contract

## Status: CONTRACT ONLY (No Live Integration)

InsightFlow is an external observability platform. This contract defines the integration surface for passive telemetry forwarding. No live InsightFlow service exists in this deployment.

## Integration Surface

### Required Interface (InsightFlow side)
```
POST /api/v1/telemetry
Content-Type: application/json
Authorization: Bearer <insightflow_api_key>

{
  "source": "tantra-bridge",
  "trace_id": "uuid",
  "execution_id": "uuid",
  "event_type": "string",
  "status": "string",
  "payload": {},
  "timestamp": "ISO-8601",
  "passive": true
}
```

### Provided Adapter
The `adapter.js` module implements this contract. When InsightFlow is available, set `INSIGHTFLOW_URL` env var and the adapter forwards telemetry.

### Passive-Only Guarantee
- All forwarded events are tagged `passive: true`
- Adapter never alters execution flow
- Adapter never generates or modifies tokens
- Adapter never makes routing decisions

## Telemetry Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| source | string | yes | Always "tantra-bridge" |
| trace_id | string | yes | Immutable trace identifier |
| execution_id | string | yes | Immutable execution identifier |
| event_type | string | yes | Telemetry event classification |
| status | string | yes | Execution status |
| payload | object | yes | Event details |
| timestamp | string | yes | ISO 8601 UTC |
| passive | boolean | yes | Always true |

## Event Types

| Event | Trigger | Status Values |
|-------|---------|---------------|
| execution_transition | State change | pending, processing, completed, failed |
| rejection | Token/ID rejection | rejected |
| dependency_failure | Service unavailable | failed |
| replay_verification | Replay check | verified, failed |


## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| INSIGHTFLOW_URL | (none) | InsightFlow endpoint URL |
| INSIGHTFLOW_API_KEY | (none) | Authentication key |
| INSIGHTFLOW_ENABLED | false | Enable forwarding |

## Readiness Verification

Run: `node services/insightflow/readiness_check.js`
