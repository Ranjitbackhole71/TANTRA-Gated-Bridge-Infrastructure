const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tantra-determinism-'));
process.env.EXECUTION_OUTPUT_DIR = outputDir;
const participant = require('../../services/execution/execution_participant');

test('Execution participant produces deterministic equivalent output for identical inputs', async () => {
  const first = await participant.executeWorkload('determinism-unit', 'same-trace', 'same-execution');
  const second = await participant.executeWorkload('determinism-unit', 'same-trace', 'same-execution');
  assert.deepEqual(second, first);
  assert.equal(second.hash, first.hash);
  fs.rmSync(outputDir, { recursive: true, force: true });
});
