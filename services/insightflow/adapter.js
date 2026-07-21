const telemetry = require('../observability/telemetry_emitter');

const INSIGHTFLOW_URL = process.env.INSIGHTFLOW_URL;
const INSIGHTFLOW_API_KEY = process.env.INSIGHTFLOW_API_KEY;
const INSIGHTFLOW_TIMEOUT_MS = parseInt(process.env.INSIGHTFLOW_TIMEOUT_MS) || 10000;
const ENABLED = process.env.INSIGHTFLOW_ENABLED === 'true';

let httpClient = null;
if (ENABLED && INSIGHTFLOW_URL) {
  try {
    httpClient = require('axios');
  } catch (e) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      trace_id: null,
      execution_id: null,
      service_name: 'insightflow',
      status: 'error',
      message: 'axios not available, insightflow disabled'
    }));
  }
}

function buildPayload(traceId, executionId, eventType, status, details) {
  return {
    source: 'tantra-bridge',
    trace_id: traceId,
    execution_id: executionId || null,
    event_type: eventType,
    status,
    payload: {
      passive: true,
      ...details
    },
    timestamp: new Date().toISOString()
  };
}

async function forward(payload) {
  if (!ENABLED || !httpClient || !INSIGHTFLOW_URL) {
    return { forwarded: false, reason: 'insightflow not configured' };
  }
  try {
    const response = await httpClient.post(
      `${INSIGHTFLOW_URL}/api/v1/telemetry`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${INSIGHTFLOW_API_KEY || ''}`
        },
        timeout: INSIGHTFLOW_TIMEOUT_MS
      }
    );
    return { forwarded: true, status: response.status };
  } catch (err) {
    return { forwarded: false, error: err.message };
  }
}

async function emitExecutionTransition(traceId, executionId, fromStatus, toStatus, details) {
  telemetry.recordExecutionTransition({ trace_id: traceId, execution_id: executionId, from_status: fromStatus, to_status: toStatus, service: 'bridge', details });
  if (ENABLED) {
    return forward(buildPayload(traceId, executionId, 'execution_transition', toStatus, { from_status: fromStatus, ...details }));
  }
  return { forwarded: false, reason: 'insightflow disabled' };
}

async function emitRejection(traceId, executionId, reason, details) {
  telemetry.recordRejection({ trace_id: traceId, execution_id: executionId, reason, service: 'bridge', details });
  if (ENABLED) {
    return forward(buildPayload(traceId, executionId, 'rejection', 'rejected', { rejection_reason: reason, ...details }));
  }
  return { forwarded: false, reason: 'insightflow disabled' };
}

async function emitDependencyFailure(traceId, executionId, dependency, error, details) {
  telemetry.recordDependencyFailure({ trace_id: traceId, execution_id: executionId, dependency, error, service: 'bridge', details });
  if (ENABLED) {
    return forward(buildPayload(traceId, executionId, 'dependency_failure', 'failed', { failed_dependency: dependency, error_message: error, ...details }));
  }
  return { forwarded: false, reason: 'insightflow disabled' };
}

async function emitReplayVerification(traceId, executionId, outcome, details) {
  telemetry.recordReplayVerification({ trace_id: traceId, execution_id: executionId, verification_id: require('crypto').randomUUID(), outcome, details });
  if (ENABLED) {
    return forward(buildPayload(traceId, executionId, 'replay_verification', outcome === 'pass' ? 'verified' : 'failed', { outcome, ...details }));
  }
  return { forwarded: false, reason: 'insightflow disabled' };
}

function isEnabled() {
  return ENABLED;
}

function isConfigured() {
  return !!(INSIGHTFLOW_URL && INSIGHTFLOW_API_KEY);
}

module.exports = {
  emitExecutionTransition,
  emitRejection,
  emitDependencyFailure,
  emitReplayVerification,
  forward,
  isEnabled,
  isConfigured
};
