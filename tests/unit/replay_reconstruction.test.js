const test = require('node:test');
const assert = require('node:assert/strict');
const { runCore } = require('./runtime_helpers');
const reconstruction = require('../../services/replay_reconstruction/reconstruction_tool');
const corruption = require('../../services/replay_reconstruction/corruption_detector');
const store = require('../../services/replay_persistence/append_only_store');

test('Replay reconstruction rebuilds a real Core trace and lineage', async () => {
  const execution = await runCore('reconstruction-unit-critical-path');
  const trace = `${execution.trace_id}-host-reconstruction`;
  store.appendRecord({ trace_id: trace, execution_id: execution.execution_id, event_type: 'unit_start', service: 'bridge', status: 'pending' });
  store.appendRecord({ trace_id: trace, execution_id: execution.execution_id, event_type: 'unit_complete', service: 'bridge', status: 'completed' });
  const rebuilt = reconstruction.reconstructTrace(trace);
  assert.equal(rebuilt.found, true);
  assert.equal(rebuilt.trace_id, trace);
  assert.equal(rebuilt.record_count, 2);
  assert.equal(reconstruction.verifyReconstructable(trace).chain_integrity, true);
});

test('Corruption detector reports the current persisted chain as clean', () => {
  const result = corruption.detectCorruption();
  assert.equal(result.corrupted, false);
  assert.equal(result.corruption_count, 0);
});

test('Corruption detector rejects a tampered record copy', async () => {
  const execution = await runCore('reconstruction-unit-corruption');
  const trace = `${execution.trace_id}-host-corruption`;
  store.appendRecord({ trace_id: trace, execution_id: execution.execution_id, event_type: 'unit_start', service: 'bridge', status: 'pending' });
  store.appendRecord({ trace_id: trace, execution_id: execution.execution_id, event_type: 'unit_complete', service: 'bridge', status: 'completed' });
  const records = store.getRecordsByTraceId(trace).map(record => ({ ...record }));
  records[1].hash = 'tampered-hash';
  const result = corruption.verifyArtifactChain(records);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.issue === 'hash_mismatch'));
});
