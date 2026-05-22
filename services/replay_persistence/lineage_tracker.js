const store = require('./append_only_store');

function recordLineageEvent(opts) {
  const { trace_id, execution_id, parent_execution_id, event_type, service, status, payload } = opts;
  return store.appendRecord({
    trace_id,
    execution_id,
    parent_execution_id: parent_execution_id || null,
    event_type: event_type || 'lineage_event',
    service: service || 'unknown',
    status: status || 'unknown',
    payload: payload || {}
  });
}

function buildLineageGraph(traceId) {
  const records = store.getRecordsByTraceId(traceId);
  const nodes = new Map();
  const edges = [];

  for (const record of records) {
    if (record.execution_id) {
      if (!nodes.has(record.execution_id)) {
        nodes.set(record.execution_id, {
          execution_id: record.execution_id,
          events: [],
          services: new Set(),
          first_seen: record.timestamp,
          last_seen: record.timestamp
        });
      }
      const node = nodes.get(record.execution_id);
      node.events.push(record.event_type);
      node.services.add(record.service);
      if (record.timestamp < node.first_seen) node.first_seen = record.timestamp;
      if (record.timestamp > node.last_seen) node.last_seen = record.timestamp;
    }
    if (record.parent_execution_id && record.execution_id) {
      edges.push({
        from: record.parent_execution_id,
        to: record.execution_id,
        event_type: record.event_type,
        timestamp: record.timestamp
      });
    }
  }

  const resultNodes = [];
  for (const [execId, node] of nodes) {
    resultNodes.push({
      execution_id: execId,
      event_count: node.events.length,
      event_types: [...new Set(node.events)],
      services: [...node.services],
      first_seen: node.first_seen,
      last_seen: node.last_seen
    });
  }

  return {
    trace_id: traceId,
    nodes: resultNodes,
    edges: edges,
    record_count: records.length
  };
}

function traceLineageDepth(traceId, executionId, direction) {
  const graph = buildLineageGraph(traceId);
  const visited = new Set();
  const chain = [];

  function traverse(currentId, depth) {
    if (visited.has(currentId) || depth > 100) return;
    visited.add(currentId);
    const node = graph.nodes.find(n => n.execution_id === currentId);
    if (node) chain.push(node);

    if (direction === 'up' || direction === 'both') {
      for (const edge of graph.edges) {
        if (edge.to === currentId) traverse(edge.from, depth + 1);
      }
    }
    if (direction === 'down' || direction === 'both') {
      for (const edge of graph.edges) {
        if (edge.from === currentId) traverse(edge.to, depth + 1);
      }
    }
  }

  if (executionId) traverse(executionId, 0);
  return { trace_id: traceId, root: executionId, chain, total_records: graph.record_count };
}

function getLineageReferences(traceId) {
  const records = store.getRecordsByTraceId(traceId);
  const refs = [];
  for (const record of records) {
    if (record.parent_hash) {
      refs.push({
        trace_id: record.trace_id,
        execution_id: record.execution_id,
        parent_hash: record.parent_hash,
        hash: record.hash,
        event_type: record.event_type,
        timestamp: record.timestamp
      });
    }
  }
  return { trace_id: traceId, immutable_references: refs, count: refs.length };
}

module.exports = {
  recordLineageEvent,
  buildLineageGraph,
  traceLineageDepth,
  getLineageReferences
};
