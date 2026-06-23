# InsightFlow Activation Proof

## Status: OPERATIONAL

## Receiver Process

| Field | Value |
|---|---|
| PID | 3496 |
| Port | 3005 |
| Startup log | `{"service_name":"insightflow-local","message":"InsightFlow Local Receiver running on port 3005"}` |
| Data directory | `services/insightflow/data/` |
| Storage file | `insightflow_telemetry.jsonl` |

## Health Endpoint

```
GET http://localhost:3005/health
→ 200 {"service":"insightflow-local","status":"healthy","port":3005}
```

## Telemetry Ingestion

```
POST http://localhost:3005/api/v1/telemetry
Body: {
  "source": "tantra-bridge",
  "trace_id": "acceptance-test-trace-0001",
  "execution_id": "acceptance-test-exec-0001",
  "event_type": "execution_transition",
  "status": "completed",
  "payload": { "passive": true, "workload": "acceptance-test" },
  "timestamp": "2026-06-22T15:34:33.5828246+05:30"
}
→ 201 {"received":true,"timestamp":"2026-06-22T10:04:33.678Z"}
```

## Telemetry Retrieval (All)

```
GET http://localhost:3005/telemetry
→ 200
{
  "count": 2,
  "total": 2,
  "events": [ ... stored telemetry ... ]
}
```

## Telemetry Retrieval (By Trace ID)

```
GET http://localhost:3005/telemetry/acceptance-test-trace-0001
→ 200
{
  "trace_id": "acceptance-test-trace-0001",
  "count": 1,
  "events": [{
    "trace_id": "acceptance-test-trace-0001",
    "event_type": "execution_transition",
    "status": "completed",
    "source": "tantra-bridge",
    ...
  }]
}
```

## Forwarding Evidence

The Bridge service (`bridge/app.js`) integrates InsightFlow via `replay_hooks.js`:

1. `replay_hooks.js` line 3: `const insightflow = require('../insightflow/adapter');`
2. `hookExecutionResponse()` calls `insightflow.forward()` with telemetry payload
3. Bridge `.env` is configured:
   - `INSIGHTFLOW_URL=http://localhost:3005`
   - `INSIGHTFLOW_API_KEY=dev-key`
   - `INSIGHTFLOW_ENABLED=true`
4. Adapter (`insightflow/adapter.js`) reads these env vars and forwards telemetry when `ENABLED && INSIGHTFLOW_URL`

## Root Cause (Previous Failure)

Previous telemetry tests failed because:
1. The PowerShell payload construction was malformed (improper JSON quoting)
2. The receiver was not running when tests were attempted

## Final Verdict

| Criterion | Result |
|---|---|
| Receiver process running | PASS |
| Health endpoint responds | PASS |
| Telemetry ingestion (POST) | PASS |
| Telemetry retrieval (GET all) | PASS |
| Trace-specific retrieval (GET by trace_id) | PASS |
| Bridge integration wired | PASS |
| `.env` configured for forwarding | PASS |

**InsightFlow is OPERATIONAL.**
