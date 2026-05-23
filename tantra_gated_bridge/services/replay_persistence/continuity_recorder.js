const store = require('./append_only_store');
const lineage = require('./lineage_tracker');

function recordContinuity(opts) {
  const { trace_id, execution_id, parent_execution_id, phase, status, details } = opts;
  return store.appendRecord({
    trace_id,
    execution_id,
    parent_execution_id: parent_execution_id || null,
    event_type: 'continuity',
    service: 'bridge',
    status: status || 'unknown',
    payload: {
      phase: phase || 'unknown',
      details: details || {}
    }
  });
}

function recordExecutionTransition(traceId, executionId, fromStatus, toStatus, details) {
  return recordContinuity({
    trace_id: traceId,
    execution_id: executionId,
    phase: 'execution_transition',
    status: toStatus,
    details: { from_status: fromStatus, ...details }
  });
}

function recordRejection(traceId, executionId, reason, details) {
  return recordContinuity({
    trace_id: traceId,
    execution_id: executionId,
    phase: 'rejection',
    status: 'rejected',
    details: { reason, ...details }
  });
}

function recordDependencyFailure(traceId, executionId, dependency, error, details) {
  return recordContinuity({
    trace_id: traceId,
    execution_id: executionId,
    phase: 'dependency_failure',
    status: 'failed',
    details: { dependency, error, ...details }
  });
}

function getContinuityChain(traceId) {
  const continuityRecords = store.getRecordsByTraceId(traceId)
    .filter(r => r.event_type === 'continuity');
  return {
    trace_id: traceId,
    continuity_records: continuityRecords,
    total: continuityRecords.length,
    phases: [...new Set(continuityRecords.map(r => r.payload?.phase))],
    statuses: [...new Set(continuityRecords.map(r => r.status))]
  };
}

function verifyContinuityIntegrity(traceId) {
  const records = store.getRecordsByTraceId(traceId);
  if (records.length === 0) {
    return { valid: false, reason: 'No records for trace' };
  }

  const gaps = [];
  for (let i = 1; i < records.length; i++) {
    if (records[i].parent_hash !== records[i - 1].hash) {
      gaps.push({
        index: i,
        expected: records[i - 1].hash,
        got: records[i].parent_hash
      });
    }
  }

  const chainState = store.getChainState();
  return {
    valid: gaps.length === 0,
    trace_id: traceId,
    record_count: records.length,
    chain_hash: chainState.last_hash,
    gaps: gaps.length > 0 ? gaps : undefined
  };
}

module.exports = {
  recordContinuity,
  recordExecutionTransition,
  recordRejection,
  recordDependencyFailure,
  getContinuityChain,
  verifyContinuityIntegrity
};
