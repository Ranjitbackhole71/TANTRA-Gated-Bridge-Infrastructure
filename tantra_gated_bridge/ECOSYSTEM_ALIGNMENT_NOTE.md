# TANTRA Gated Bridge — Ecosystem Alignment Note

## 1. Participation Model

TANTRA Gated Bridge participates in the broader ecosystem as a **passive observable participant**. It emits structured telemetry into an append-only replay log. It does not:

- Push telemetry to external systems
- Register with service meshes
- Participate in distributed consensus
- Accept remote control commands
- Report to governance authorities

## 2. Integration Points

### 2.1 Log Forwarding (Pull-based)

External systems can read `services/replay_persistence/data/replay_log.jsonl` directly or via a log forwarder (Filebeat, Fluentd, Logstash).

**Integration contract**:
- Input: JSONL file with one event per line
- Format: Conforms to `services/replay_persistence/schema.json`
- Access: Read-only filesystem

### 2.2 REST API (Pull-based)

Each service exposes a `/health` endpoint. External monitoring systems can poll these endpoints.

**Integration contract**:
- Endpoint: `GET /health`
- Response: `{ "service": "<name>", "status": "healthy" }`
- Ports: 3000-3004

### 2.3 Trace Reconstruction API (Pull-based)

External systems can use `replay_reconstruction/reconstruction_tool.js` to programmatically reconstruct traces.

**Integration contract**:
- Function: `reconstructTrace(traceId)`
- Returns: Complete trace with all executions, lineage, and continuity data
- Access: Node.js require()

## 3. Ecosystem Compatibility

### 3.1 Compatible With

| System | Compatibility | Method |
|---|---|---|
| Logstash/Elasticsearch | Native | JSONL ingestion via file input |
| Fluentd | Native | in_tail plugin for JSONL |
| Loki/Promtail | Native | JSONL scraping |
| Grafana | Via Loki | LogQL queries on telemetry events |
| Datadog | Via agent | Log file tailing |
| Splunk | Via forwarder | JSONL monitoring |
| InsightFlow | Contract stub provided | See `docs/ECOSYSTEM_PARTICIPATION.md` |

### 3.2 Not Compatible With

| System | Reason |
|---|---|
| Service meshes (Istio/Linkerd) | No sidecar injection configured |
| Distributed tracing (Jaeger/Zipkin) | No trace context propagation headers |
| Message queues (Kafka/NATS) | No built-in producer integration |
| Governance engines (OPA) | No policy decision points exposed |

## 4. Alignment Principles

### 4.1 Passive Only

TANTRA Gated Bridge emits but does not act. All telemetry is tagged `passive: true`. No module can autonomously alter behavior based on telemetry.

### 4.2 No Lock-In

All state is stored in open formats:
- JSONL for replay log
- JSON for chain state
- SQLite for artifacts
- RS256 JWT for tokens

No proprietary formats or protocols.

### 4.3 Verifiable

All ecosystem contracts are:
- Documented with specific IDs (OBS-CORE-001, TEL-EXPORT-001, etc.)
- Automatically verifiable via the proof harness in `docs/ECOSYSTEM_PARTICIPATION.md`
- Enforced by design (passive tags, read-only reconstruction, append-only persistence)

## 5. Gap: InsightFlow Integration

InsightFlow integration is not implemented. An integration contract stub is provided in `docs/ECOSYSTEM_PARTICIPATION.md` (section 5.2).

To complete InsightFlow integration:
1. Implement a log forwarder that reads `replay_log.jsonl` and pushes to InsightFlow
2. Or configure InsightFlow to poll the file directly
3. Use the provided stub as a reference implementation

The stub is passive-only, read-only, and requires no changes to TANTRA core modules.
