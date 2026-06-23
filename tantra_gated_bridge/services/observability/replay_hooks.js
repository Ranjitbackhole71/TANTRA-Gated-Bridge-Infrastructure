const telemetry = require('./telemetry_emitter');
const trace = require('./trace_collector');
const insightflow = require('../insightflow/adapter');

function insightflowForward(fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      result.catch(() => {});
    }
  } catch (e) { /* passive */ }
}

function hookExecutionRequest(req, res, next) {
  const traceId = req.trace_id || req.body?.trace_id;
  const executionId = req.execution_id || req.body?.execution_id;

  telemetry.emitExecutionTelemetry({
    trace_id: traceId,
    execution_id: executionId,
    service: 'bridge',
    event_type: 'request_received',
    status: 'pending',
    payload: {
      method: req.method,
      path: req.path,
      has_token: !!req.headers.authorization
    }
  });

  trace.emitTrace({
    trace_id: traceId,
    execution_id: executionId,
    service: 'bridge',
    span_name: 'bridge_ingress',
    status: 'pending',
    payload: { method: req.method, path: req.path }
  });

  next();
}

function guard(fn) {
  try { return fn(); } catch (e) { /* passive telemetry - skip on failure */ }
}

function hookExecutionResponse(traceId, executionId, status, details) {
  guard(() => telemetry.emitExecutionTelemetry({
    trace_id: traceId,
    execution_id: executionId,
    service: 'bridge',
    event_type: 'response_sent',
    status,
    payload: details
  }));
  insightflowForward(() => insightflow.forward({
    source: 'tantra-bridge',
    trace_id: traceId,
    execution_id: executionId,
    event_type: 'response_sent',
    status,
    payload: { passive: true, ...details },
    timestamp: new Date().toISOString()
  }));
}

function hookExecutionFailure(traceId, executionId, error, dependency) {
  guard(() => telemetry.recordDependencyFailure({
    trace_id: traceId,
    execution_id: executionId,
    dependency: dependency || 'unknown',
    error: error?.message || String(error),
    service: 'bridge'
  }));
}

function hookRejection(traceId, executionId, reason) {
  guard(() => telemetry.recordRejection({
    trace_id: traceId,
    execution_id: executionId,
    reason,
    service: 'bridge'
  }));
}

function hookReplayVerification(traceId, executionId, outcome, details) {
  guard(() => telemetry.recordReplayVerification({
    trace_id: traceId,
    execution_id,
    verification_id: require('crypto').randomUUID(),
    outcome,
    details
  }));
}

function hookServiceTransition(traceId, executionId, service, fromStatus, toStatus) {
  guard(() => telemetry.recordExecutionTransition({
    trace_id: traceId,
    execution_id: executionId,
    service,
    from_status: fromStatus,
    to_status: toStatus
  }));
}

module.exports = {
  hookExecutionRequest,
  hookExecutionResponse,
  hookExecutionFailure,
  hookRejection,
  hookReplayVerification,
  hookServiceTransition
};
