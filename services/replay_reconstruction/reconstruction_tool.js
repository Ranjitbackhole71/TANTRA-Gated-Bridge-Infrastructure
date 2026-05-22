const store = require('../replay_persistence/append_only_store');
const lineage = require('../replay_persistence/lineage_tracker');
const continuity = require('../replay_persistence/continuity_recorder');

function reconstructExecution(traceId, executionId) {
  const records = store.getRecordsByExecutionId(executionId);
  if (records.length === 0) {
    return { found: false, trace_id: traceId, execution_id: executionId };
  }

  const phases = [];
  const transitions = [];
  let rejection = null;
  let dependencyFailure = null;

  for (const record of records) {
    const phase = {
      event_type: record.event_type,
      service: record.service,
      status: record.status,
      timestamp: record.timestamp,
      payload: record.payload
    };
    phases.push(phase);

    if (record.event_type === 'continuity' && record.payload?.phase === 'execution_transition') {
      transitions.push({
        from: record.payload?.details?.from_status,
        to: record.status,
        timestamp: record.timestamp
      });
    }
    if (record.event_type === 'continuity' && record.payload?.phase === 'rejection') {
      rejection = { reason: record.payload?.details?.reason, timestamp: record.timestamp };
    }
    if (record.event_type === 'continuity' && record.payload?.phase === 'dependency_failure') {
      dependencyFailure = {
        dependency: record.payload?.details?.dependency,
        error: record.payload?.details?.error,
        timestamp: record.timestamp
      };
    }
  }

  return {
    found: true,
    trace_id: traceId,
    execution_id: executionId,
    phases,
    transitions,
    rejection,
    dependency_failure: dependencyFailure,
    phase_count: phases.length,
    transition_count: transitions.length
  };
}

function reconstructTrace(traceId) {
  const records = store.getRecordsByTraceId(traceId);
  if (records.length === 0) {
    return { found: false, trace_id: traceId };
  }

  const executionIds = [...new Set(records.filter(r => r.execution_id).map(r => r.execution_id))];
  const executionReconstructions = executionIds.map(eid => reconstructExecution(traceId, eid));
  const graph = lineage.buildLineageGraph(traceId);
  const continuityChain = continuity.getContinuityChain(traceId);

  return {
    found: true,
    trace_id: traceId,
    execution_count: executionIds.length,
    record_count: records.length,
    executions: executionReconstructions,
    lineage_graph: graph,
    continuity: continuityChain,
    first_event: records[0]?.timestamp,
    last_event: records[records.length - 1]?.timestamp
  };
}

function reconstructByTimeRange(startTime, endTime) {
  const allRecords = store.getAllRecords();
  const filtered = allRecords.filter(r => {
    const t = new Date(r.timestamp).getTime();
    return t >= new Date(startTime).getTime() && t <= new Date(endTime).getTime();
  });

  const traceIds = [...new Set(filtered.map(r => r.trace_id))];
  return {
    time_range: { start: startTime, end: endTime },
    trace_count: traceIds.length,
    record_count: filtered.length,
    traces: traceIds.map(id => reconstructTrace(id))
  };
}

function verifyReconstructable(traceId) {
  const result = reconstructTrace(traceId);
  if (!result.found) return { reconstructable: false, reason: 'Trace not found' };

  const integrity = store.validateChainIntegrity();
  const continuityValid = continuity.verifyContinuityIntegrity(traceId);

  return {
    reconstructable: true,
    trace_id: traceId,
    chain_integrity: integrity.valid,
    continuity_integrity: continuityValid.valid,
    record_count: result.record_count,
    execution_count: result.execution_count,
    linked: result.lineage_graph.edges.length > 0
  };
}

if (require.main === module) {
  const traceId = process.argv[2];
  if (!traceId) {
    console.log('Usage: node reconstruction_tool.js <trace_id>');
    process.exit(1);
  }
  const result = reconstructTrace(traceId);
  console.log(JSON.stringify(result, null, 2));
  console.log('\nVerify reconstructable:', JSON.stringify(verifyReconstructable(traceId), null, 2));
}

module.exports = {
  reconstructExecution,
  reconstructTrace,
  reconstructByTimeRange,
  verifyReconstructable
};
