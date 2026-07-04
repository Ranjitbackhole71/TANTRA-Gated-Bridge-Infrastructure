const store = require('../replay_persistence/append_only_store');

let insightflowAdapter = null;
try {
  if (process.env.INSIGHTFLOW_ENABLED === 'true') {
    insightflowAdapter = require('../insightflow/adapter');
  }
} catch (e) {
  // InsightFlow adapter not available — passive telemetry only
}

function emitExecutionTelemetry(opts) {
  const { trace_id, execution_id, parent_execution_id, service, event_type, status, payload } = opts;
  const record = store.appendRecord({
    trace_id,
    execution_id,
    parent_execution_id: parent_execution_id || null,
    event_type: `telemetry:${event_type}`,
    service,
    status,
    payload: {
      telemetry: true,
      passive: true,
      ...payload
    }
  });

  if (insightflowAdapter && insightflowAdapter.isEnabled()) {
    insightflowAdapter.forward({
      source: service || 'tantra',
      trace_id,
      execution_id,
      event_type: `telemetry:${event_type}`,
      status,
      payload: { passive: true, ...payload },
      timestamp: new Date().toISOString()
    }).catch(() => {});
  }

  return record;
}

function recordExecutionTransition(transition) {
  const { trace_id, execution_id, from_status, to_status, service, details } = transition;
  return emitExecutionTelemetry({
    trace_id,
    execution_id,
    service: service || 'bridge',
    event_type: 'execution_transition',
    status: to_status,
    payload: {
      from_status,
      transition_type: 'state_change',
      ...details
    }
  });
}

function recordRejection(entry) {
  const { trace_id, execution_id, reason, service, details } = entry;
  return emitExecutionTelemetry({
    trace_id,
    execution_id,
    service: service || 'bridge',
    event_type: 'rejection',
    status: 'rejected',
    payload: {
      rejection_reason: reason,
      ...details
    }
  });
}

function recordDependencyFailure(entry) {
  const { trace_id, execution_id, dependency, error, service, details } = entry;
  return emitExecutionTelemetry({
    trace_id,
    execution_id,
    service: service || 'bridge',
    event_type: 'dependency_failure',
    status: 'failed',
    payload: {
      failed_dependency: dependency,
      error_message: error,
      failure_type: 'dependency_unavailable',
      ...details
    }
  });
}

function recordReplayVerification(entry) {
  const { trace_id, execution_id, verification_id, outcome, details } = entry;
  return emitExecutionTelemetry({
    trace_id,
    execution_id: execution_id || null,
    service: 'replay_reconstruction',
    event_type: 'replay_verification',
    status: outcome === 'pass' ? 'verified' : 'failed',
    payload: {
      verification_id,
      outcome,
      ...details
    }
  });
}

function getTelemetryForTrace(traceId) {
  const records = store.getRecordsByTraceId(traceId);
  return records.filter(r => r.event_type && r.event_type.startsWith('telemetry:'));
}

function getTelemetrySummary(traceId) {
  const telemetry = getTelemetryForTrace(traceId);
  const eventTypes = {};
  const statuses = {};
  const services = new Set();

  for (const record of telemetry) {
    eventTypes[record.event_type] = (eventTypes[record.event_type] || 0) + 1;
    statuses[record.status] = (statuses[record.status] || 0) + 1;
    if (record.service) services.add(record.service);
  }

  return {
    trace_id: traceId,
    total_telemetry_events: telemetry.length,
    event_types: eventTypes,
    statuses,
    services: [...services],
    passive_only: telemetry.every(r => r.payload?.passive === true)
  };
}

module.exports = {
  emitExecutionTelemetry,
  recordExecutionTransition,
  recordRejection,
  recordDependencyFailure,
  recordReplayVerification,
  getTelemetryForTrace,
  getTelemetrySummary
};
