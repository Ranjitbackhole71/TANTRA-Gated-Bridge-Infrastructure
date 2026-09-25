const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { requestJson, issueToken } = require('./runtime_helpers');

test('Execution validates a real Bridge signature and immutable IDs', async () => {
  const trace = crypto.randomUUID(); const execution = crypto.randomUUID(); const cet = 'execution-unit-cet';
  const token = await issueToken(trace, execution, cet);
  const valid = await requestJson('http://localhost:3003/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workload: 'execution-unit', trace_id: trace, execution_id: execution, bridge_signature: `Bearer ${token.token}` }) });
  assert.equal(valid.status, 200);
  assert.equal(valid.body.trace_id, trace);
  assert.equal(valid.body.execution_id, execution);

  const mutated = await requestJson('http://localhost:3003/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workload: 'execution-unit', trace_id: 'mutated', execution_id: execution, bridge_signature: `Bearer ${token.token}` }) });
  assert.equal(mutated.status, 400);
});
