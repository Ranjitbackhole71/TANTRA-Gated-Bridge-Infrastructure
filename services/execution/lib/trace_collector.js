const store = require('./append_only_store');
const crypto = require('crypto');

function emitTrace(opts) {
  const { trace_id, execution_id, parent_execution_id, service, span_name, status, payload } = opts;
  const spanId = crypto.randomUUID();
  const record = store.appendRecord({
    trace_id,
    execution_id,
    parent_execution_id: parent_execution_id || null,
    event_type: `trace:${span_name}`,
    service,
    status,
    payload: {
      span_id: spanId,
      trace_passive: true,
      ...payload
    }
  });
  return { span_id: spanId, ...record };
}

function emitDistributedTrace(traceId, services) {
  const spans = [];
  for (let i = 0; i < services.length; i++) {
    const span = emitTrace({
      trace_id: traceId,
      execution_id: services[i].execution_id || null,
      parent_execution_id: i > 0 ? services[i - 1].execution_id || null : null,
      service: services[i].name,
      span_name: `hop_${i}_${services[i].name}`,
      status: services[i].status || 'unknown',
      payload: {
        hop: i,
        from: i > 0 ? services[i - 1].name : 'initiator',
        to: services[i].name,
        ...services[i].details
      }
    });
    spans.push(span);
  }
  return { trace_id: traceId, span_count: spans.length, spans };
}

function getTraceSpans(traceId) {
  const records = store.getRecordsByTraceId(traceId);
  return records.filter(r => r.event_type && r.event_type.startsWith('trace:'));
}

function rebuildTraceTree(traceId) {
  const spans = getTraceSpans(traceId);
  if (spans.length === 0) return null;

  const spanMap = new Map();
  const roots = [];

  for (const span of spans) {
    const spanId = span.payload?.span_id || span.hash;
    spanMap.set(spanId, {
      span_id: spanId,
      trace_id: span.trace_id,
      execution_id: span.execution_id,
      service: span.service,
      event_type: span.event_type,
      status: span.status,
      timestamp: span.timestamp,
      parent_execution_id: span.parent_execution_id,
      children: []
    });
  }

  for (const span of spans) {
    const spanId = span.payload?.span_id || span.hash;
    const node = spanMap.get(spanId);
    if (span.parent_execution_id) {
      const parent = spans.find(s => s.execution_id === span.parent_execution_id);
      if (parent) {
        const parentId = parent.payload?.span_id || parent.hash;
        const parentNode = spanMap.get(parentId);
        if (parentNode) {
          parentNode.children.push(node);
          continue;
        }
      }
    }
    roots.push(node);
  }

  return { trace_id: traceId, roots, total_spans: spans.length };
}

function getDistributedTraceSummary(traceId) {
  const spans = getTraceSpans(traceId);
  const services = new Map();
  const statusCounts = {};

  for (const span of spans) {
    if (span.service) {
      const s = services.get(span.service) || { count: 0, statuses: {} };
      s.count += 1;
      s.statuses[span.status] = (s.statuses[span.status] || 0) + 1;
      services.set(span.service, s);
    }
    statusCounts[span.status] = (statusCounts[span.status] || 0) + 1;
  }

  return {
    trace_id: traceId,
    total_spans: spans.length,
    unique_services: services.size,
    services: Object.fromEntries(services),
    status_summary: statusCounts
  };
}

module.exports = {
  emitTrace,
  emitDistributedTrace,
  getTraceSpans,
  rebuildTraceTree,
  getDistributedTraceSummary
};
