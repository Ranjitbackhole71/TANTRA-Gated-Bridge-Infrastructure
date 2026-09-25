const test = require('node:test');
const assert = require('node:assert/strict');
const { runCore, requestJson, waitForTelemetry } = require('./runtime_helpers');

test('InsightFlow receiver exposes telemetry routes for a real Core execution', async () => {
  const execution = await runCore('insightflow-unit-critical-path');
  const all = await requestJson('http://localhost:3005/telemetry');
  const summary = await requestJson('http://localhost:3005/telemetry/summary');
  const trace = await waitForTelemetry(execution.trace_id, 3);
  assert.equal(all.status, 200);
  assert.equal(summary.status, 200);
  assert.ok(trace.count >= 3);
  assert.ok(trace.events.every(event => event.trace_id === execution.trace_id));
});

test('InsightFlow telemetry is passive and tied to the real execution ID', async () => {
  const execution = await runCore('insightflow-unit-passive');
  const trace = await waitForTelemetry(execution.trace_id, 3);
  assert.ok(trace.events.length >= 3);
  assert.ok(trace.events.every(event => event.execution_id === execution.execution_id && event.payload.passive === true));
});
