const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUTPUT_DIR = process.env.EXECUTION_OUTPUT_DIR || path.join(__dirname, 'outputs');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function executeWorkload(workload, trace_id, execution_id) {
  const result = {
    workload,
    output: `Processed ${workload}`,
    trace_id,
    execution_id
  };

  const outputFile = path.join(OUTPUT_DIR, `${execution_id}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));

  const hash = crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex');

  return {
    ...result,
    hash,
    output_file: outputFile
  };
}

function getExecutionOutput(executionId) {
  const outputFile = path.join(OUTPUT_DIR, `${executionId}.json`);
  if (!fs.existsSync(outputFile)) return null;
  return JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
}

function getAllOutputs() {
  if (!fs.existsSync(OUTPUT_DIR)) return [];
  return fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => ({
      execution_id: f.replace('.json', ''),
      path: path.join(OUTPUT_DIR, f)
    }));
}

module.exports = { executeWorkload, getExecutionOutput, getAllOutputs };
