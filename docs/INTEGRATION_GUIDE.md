# TANTRA Gated Bridge — Integration Guide

**Version**: 1.0.0
**Date**: 2026-07-14

---

## 1. Overview

This guide walks integrators through connecting external systems to the TANTRA Gated Bridge pipeline. TANTRA supports two integration patterns: **inbound** (submitting workloads) and **outbound** (consuming telemetry and artifacts).

See also: `docs/ATTACHMENT_GUIDE.md` for attachment point contracts and `docs/CONSUMER_GUIDE.md` for consumer-specific guides.

---

## 2. Integration Patterns

| Pattern | Direction | Protocol | Use Case |
|---|---|---|---|
| Workload Submission | Inbound | HTTP POST | Execute workloads through TANTRA |
| Telemetry Ingestion | Outbound | File read | Consume observability events |
| Health Monitoring | Outbound | HTTP GET | Poll service health |
| Artifact Retrieval | Outbound | HTTP GET | Retrieve execution results |
| Trace Reconstruction | Outbound | Node.js require() | Programmatic trace analysis |
| JWKS Discovery | Outbound | HTTP GET | Verify JWT tokens externally |

---

## 3. Prerequisites

### For Workload Submission

- Network access to port 3000 (Core)
- HTTP client (curl, axios, httpx, etc.)
- JSON request body capability

### For Telemetry Ingestion

- Filesystem read access to `services/replay_persistence/data/replay_log.jsonl`
- JSONL-compatible log forwarder (Filebeat, Fluentd, Logstash) or custom reader

### For Health Monitoring

- Network access to ports 3000-3005
- HTTP client with timeout support

### For Artifact Retrieval

- Network access to port 3004 (Bucket)
- HTTP client

### For Trace Reconstruction

- Node.js 18+ runtime
- Filesystem read access to `services/replay_persistence/data/replay_log.jsonl`

---

## 4. Step-by-Step: Workload Submission

### 4.1 Verify Core is Running

```bash
curl http://localhost:3000/health
```

Expected: `{"service":"core","status":"healthy"}`

### 4.2 Submit a Workload

```bash
curl -X POST http://localhost:3000/initiate \
  -H "Content-Type: application/json" \
  -d '{"workload": "integration-test"}'
```

### 4.3 Verify Response

Expected response structure:

```json
{
  "trace_id": "uuid",
  "execution_id": "uuid",
  "cet_hash": "sha256-hex",
  "status": "completed",
  "result": {
    "workload": "integration-test",
    "output": "Processed integration-test",
    "trace_id": "uuid",
    "execution_id": "uuid"
  },
  "artifact_location": "artifacts/{trace_id}/{execution_id}",
  "duration_ms": 101
}
```

### 4.4 Verify Artifact Stored

```bash
curl http://localhost:3004/retrieve/{trace_id}/{execution_id}
```

### 4.5 Verify Replay Recorded

```bash
tail -1 services/replay_persistence/data/replay_log.jsonl | python -m json.tool
```

---

## 5. Step-by-Step: Telemetry Ingestion

### 5.1 Verify Replay Log Exists

```bash
wc -l services/replay_persistence/data/replay_log.jsonl
```

### 5.2 Read Events (Python Example)

```python
import json

with open("services/replay_persistence/data/replay_log.jsonl") as f:
    for line in f:
        event = json.loads(line.strip())
        if event.get("event_type", "").startswith("telemetry:"):
            print(f"[{event['service']}] {event['event_type']}")
```

### 5.3 Configure Logstash (Example)

```ruby
input {
  file {
    path => "/path/to/services/replay_persistence/data/replay_log.jsonl"
    codec => json_lines
    sincedb_path => "/tmp/tantra_sincedb"
  }
}

filter {
  if [event_type] =~ /^telemetry:/ {
    mutate { add_tag => ["tantra"] }
  }
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "tantra-telemetry-%{+YYYY.MM.dd}"
  }
}
```

---

## 6. Step-by-Step: Health Monitoring

### 6.1 Check All Services

```bash
for port in 3000 3001 3002 3003 3004 3005; do
  echo -n "Port $port: "
  curl -s --connect-timeout 2 http://localhost:$port/health
  echo
done
```

### 6.2 Integrate with Monitoring System

Configure your monitoring system to poll:

| Endpoint | Interval | Timeout |
|---|---|---|
| `http://localhost:3000/health` | 30s | 5s |
| `http://localhost:3001/health` | 30s | 5s |
| `http://localhost:3002/health` | 30s | 5s |
| `http://localhost:3003/health` | 30s | 5s |
| `http://localhost:3004/health` | 30s | 5s |
| `http://localhost:3005/health` | 60s | 5s |

---

## 7. Step-by-Step: Trace Reconstruction

### 7.1 Reconstruct a Trace

```javascript
const { reconstructTrace } = require('./services/replay_reconstruction/reconstruction_tool');

const trace = reconstructTrace('a71bf018-cde6-4ef2-bafe-b11de9ecd68b');
console.log(JSON.stringify(trace, null, 2));
```

### 7.2 Verify Chain Integrity

```javascript
const { validateChainIntegrity } = require('./services/replay_persistence/append_only_store');

const result = validateChainIntegrity();
console.log('Valid:', result.valid);
console.log('Records:', result.record_count);
console.log('Errors:', result.errors.length);
```

---

## 8. Integration Verification Script

```bash
#!/bin/bash
# integration_verify.sh — Verify TANTRA integration points

echo "=== TANTRA Integration Verification ==="

echo "1. Core health..."
curl -s http://localhost:3000/health | python -m json.tool

echo "2. Submit workload..."
RESPONSE=$(curl -s -X POST http://localhost:3000/initiate \
  -H "Content-Type: application/json" \
  -d '{"workload":"integration-verify"}')
echo "$RESPONSE" | python -m json.tool

TRACE_ID=$(echo "$RESPONSE" | python -c "import sys,json; print(json.load(sys.stdin)['trace_id'])")
EXEC_ID=$(echo "$RESPONSE" | python -c "import sys,json; print(json.load(sys.stdin)['execution_id'])")

echo "3. Retrieve artifact..."
curl -s http://localhost:3004/retrieve/$TRACE_ID/$EXEC_ID | python -m json.tool

echo "4. Chain integrity..."
node -e "
const s = require('./services/replay_persistence/append_only_store');
const r = s.validateChainIntegrity();
console.log('Valid:', r.valid, '| Records:', r.record_count);
"

echo "=== Integration Verification Complete ==="
```

---

## 9. Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| Connection refused on port 3000 | Core not running | Start Core: `cd services/core && node app.js` |
| 503 from Core | Sarathi unavailable | Start Sarathi first: `cd services/sarathi && node app.js` |
| 401 from Bridge | Invalid or replayed JWT | Obtain new token from Sarathi |
| 404 from Bucket | Artifact not stored | Check Execution service logs |
| Empty replay log | No requests processed | Submit a workload first |

---

## References

| Document | Location |
|---|---|
| Attachment Guide | `docs/ATTACHMENT_GUIDE.md` |
| Consumer Guide | `docs/CONSUMER_GUIDE.md` |
| API Reference | `docs/API.md` |
| Architecture | `docs/ARCHITECTURE.md` |
| Ecosystem Contracts | `tantra_gated_bridge/docs/ECOSYSTEM_PARTICIPATION.md` |
| Ecosystem Alignment | `tantra_gated_bridge/ECOSYSTEM_ALIGNMENT_NOTE.md` |
