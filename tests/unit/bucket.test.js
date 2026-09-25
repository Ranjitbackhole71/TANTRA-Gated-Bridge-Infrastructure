const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { requestJson } = require('./runtime_helpers');

test('Bucket stores and retrieves a real artifact with hash verification', async () => {
  const trace = `bucket-unit-${crypto.randomUUID()}`; const execution = crypto.randomUUID();
  const payload = { trace_id: trace, execution_id: execution, result: { workload: 'bucket-unit', value: 42 }, duration_ms: 1 };
  const stored = await requestJson('http://localhost:3004/store', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  assert.equal(stored.status, 201);
  assert.equal(stored.body.verified, true);
  const retrieved = await requestJson(`http://localhost:3004/retrieve/${trace}/${execution}`);
  assert.equal(retrieved.status, 200);
  assert.equal(retrieved.body.hash, stored.body.hash);
  assert.deepEqual(retrieved.body.result, payload.result);
});
