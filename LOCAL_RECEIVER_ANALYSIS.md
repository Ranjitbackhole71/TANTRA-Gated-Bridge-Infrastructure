# LOCAL_RECEIVER_ANALYSIS.md

## File Location
`C:\Users\Ranjit\services\insightflow\local_receiver.js`

## Default Port
- **3005** (line 8): `const PORT = process.env.INSIGHTFLOW_PORT || 3005;`

## Port Configuration Mechanism
- Environment variable: `INSIGHTFLOW_PORT`
- No CLI argument parsing exists
- No hardcoded fallback other than 3005

## Environment Variables Used

| Variable | Purpose | Default |
|----------|---------|---------|
| `INSIGHTFLOW_PORT` | HTTP listen port | 3005 |
| `INSIGHTFLOW_DATA_DIR` | Storage directory for telemetry JSONL file | `<scriptDir>/data` |

## CLI Arguments Supported
- **None**. No `process.argv` parsing.
- Must be configured via environment variables or defaults.

## Hardcoded Ports
- Only `3005` as default for the HTTP server

## Health Endpoint
- `GET /health`
- Response: `{ service: 'insightflow-local', status: 'healthy', port: <PORT> }`
- Returns HTTP 200 when receiver is running

## Telemetry Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/telemetry` | Receive and store telemetry payload |
| GET | `/telemetry` | List all telemetry, optional `?trace_id=` filter |
| GET | `/telemetry/:traceId` | Get events by trace ID |
| GET | `/telemetry/summary` | Aggregated summary |

## Telemetry Storage
- File: `<INSIGHTFLOW_DATA_DIR>/insightflow_telemetry.jsonl`
- Append-only JSONL format
- Each line: original payload + `received_at` timestamp

## Dependencies
- express ^4.22.2
- Package name: `tantra-insightflow-local`

## Observations
- Adapter in `C:\Users\Ranjit\tantra_gated_bridge\services\insightflow\adapter.js` uses `INSIGHTFLOW_URL`, `INSIGHTFLOW_API_KEY`, `INSIGHTFLOW_ENABLED`
- Adapter forwards to `<INSIGHTFLOW_URL>/api/v1/telemetry`
- No authentication enforcement on the receiver side (API key accepted via header but not validated)
- Receiver has no TLS — HTTP only
