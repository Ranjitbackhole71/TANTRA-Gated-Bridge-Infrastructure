const test = require('node:test');
const assert = require('node:assert/strict');
const { runCore } = require('./runtime_helpers');
const telemetry = require('../../services/observability/telemetry_emitter');
const replayHooks = require('../../services/observability/replay_hooks');

test('Observability emits and collects telemetry for a real execution', async () => {
  const execution = await runCore('observability-unit-critical-path');
  telemetry.emitExecutionTelemetry({
    trace_id: execution.trace_id,
    execution_id: execution.execution_id,
    service: 'bridge',
    event_type: 'unit_observation',
    status: 'completed',
    payload: { source_execution: true }
  });
  const events = telemetry.getTelemetryForTrace(execution.trace_id);
  assert.ok(events.some(event => event.event_type === 'telemetry:unit_observation'));
  assert.ok(events.every(event => event.payload.passive === true));
});

test('Replay hooks expose the real service transition API', () => {
  assert.equal(typeof replayHooks.hookServiceTransition, 'function');
  assert.equal(typeof replayHooks.hookRejection, 'function');
  assert.equal(typeof replayHooks.hookExecutionFailure, 'function');
});
