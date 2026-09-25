const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../../services/replay_persistence/append_only_store');
const jtiStore = require('../../services/replay_persistence/jti_store');
const { runCore } = require('./runtime_helpers');
const crypto = require('node:crypto');

test('Replay persistence maintains an append-only hash chain for real events', async () => {
  const execution = await runCore('replay-persistence-unit');
  const trace = `${execution.trace_id}-host-persistence`;
  store.appendRecord({ trace_id: trace, execution_id: execution.execution_id, event_type: 'unit_start', service: 'bridge', status: 'pending' });
  store.appendRecord({ trace_id: trace, execution_id: execution.execution_id, event_type: 'unit_complete', service: 'bridge', status: 'completed' });
  const records = store.getRecordsByTraceId(trace);
  assert.equal(records.length, 2);
  assert.equal(store.validateChainIntegrity().valid, true);
  assert.ok(records.every(record => record.hash && record.sequence));
});

test('Replay persistence contains the real execution JTI and detects it', async () => {
  const execution = await runCore('replay-jti-unit');
  const jti = crypto.randomUUID();
  store.appendRecord({ trace_id: `${execution.trace_id}-host-jti`, execution_id: execution.execution_id, event_type: 'jti_used', service: 'bridge', status: 'recorded', payload: { jti } });
  jtiStore.resetMemoryCache();
  const first = jtiStore.recordJti({ trace_id: `${execution.trace_id}-host-jti`, execution_id: execution.execution_id, jti });
  const duplicate = jtiStore.recordJti({ trace_id: `${execution.trace_id}-host-jti`, execution_id: execution.execution_id, jti });
  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(jtiStore.hasJti(jti), true);
});
