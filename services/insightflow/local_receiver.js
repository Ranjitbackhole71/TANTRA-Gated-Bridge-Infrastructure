const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.INSIGHTFLOW_PORT || 3005;
const DATA_DIR = process.env.INSIGHTFLOW_DATA_DIR || path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const telemetryLog = path.join(DATA_DIR, 'insightflow_telemetry.jsonl');

const log = (msg) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    service_name: 'insightflow-local',
    message: msg
  }));
};

function appendTelemetry(payload) {
  const line = JSON.stringify({ ...payload, received_at: new Date().toISOString() }) + '\n';
  fs.appendFileSync(telemetryLog, line, 'utf-8');
  return true;
}

function getAllTelemetry() {
  if (!fs.existsSync(telemetryLog)) return [];
  return fs.readFileSync(telemetryLog, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); } catch (e) { return null; }
    })
    .filter(Boolean);
}

function getTelemetryByTraceId(traceId) {
  return getAllTelemetry().filter(t => t.trace_id === traceId);
}

function getTelemetrySummary() {
  const all = getAllTelemetry();
  const byTrace = new Map();
  for (const t of all) {
    if (!byTrace.has(t.trace_id)) byTrace.set(t.trace_id, []);
    byTrace.get(t.trace_id).push(t);
  }
  return {
    total_events: all.length,
    unique_traces: byTrace.size,
    traces: Array.from(byTrace.entries()).map(([id, events]) => ({
      trace_id: id,
      event_count: events.length,
      sources: [...new Set(events.map(e => e.source || e.service || 'unknown'))],
      first_seen: events[0]?.timestamp || events[0]?.received_at,
      last_seen: events[events.length - 1]?.timestamp || events[events.length - 1]?.received_at
    }))
  };
}

app.get('/health', (req, res) => {
  res.json({ service: 'insightflow-local', status: 'healthy', port: PORT });
});

app.post('/api/v1/telemetry', (req, res) => {
  const payload = req.body;
  if (!payload) {
    return res.status(400).json({ error: 'Empty payload' });
  }
  try {
    appendTelemetry(payload);
    log(`Telemetry received: ${payload.event_type || 'unknown'} from ${payload.source || 'unknown'}`);
    res.status(201).json({ received: true, timestamp: new Date().toISOString() });
  } catch (err) {
    log(`Failed to store telemetry: ${err.message}`);
    res.status(500).json({ error: 'Storage failed' });
  }
});

app.get('/telemetry', (req, res) => {
  const { trace_id, limit: limitParam } = req.query;
  let results = trace_id ? getTelemetryByTraceId(trace_id) : getAllTelemetry();
  const limit = parseInt(limitParam) || results.length;
  results = results.slice(-limit);
  res.json({
    trace_id: trace_id || null,
    count: results.length,
    total: trace_id ? results.length : getAllTelemetry().length,
    events: results
  });
});

app.get('/telemetry/:traceId', (req, res) => {
  const { traceId } = req.params;
  const events = getTelemetryByTraceId(traceId);
  res.json({
    trace_id: traceId,
    count: events.length,
    events
  });
});

app.get('/telemetry/summary', (req, res) => {
  res.json(getTelemetrySummary());
});

app.listen(PORT, () => {
  log(`InsightFlow Local Receiver running on port ${PORT}`);
  log(`Data directory: ${DATA_DIR}`);
});
