const test = require('node:test');
const assert = require('node:assert/strict');
const { runCore } = require('./runtime_helpers');

test('Core initiates and orchestrates a real completed workflow', async () => {
  const result = await runCore('core-unit-critical-path');
  assert.equal(result.status, 'completed');
  assert.equal(result.result.trace_id, result.trace_id);
  assert.equal(result.result.execution_id, result.execution_id);
  assert.match(result.result.artifact_location, new RegExp(`${result.trace_id}/${result.execution_id}$`));
});
