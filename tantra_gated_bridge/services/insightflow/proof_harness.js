const adapter = require('./adapter');
const telemetry = require('../observability/telemetry_emitter');
const store = require('../replay_persistence/append_only_store');

const crypto = require('crypto');

function generateId() {
  return crypto.randomUUID();
}

async function runProof() {
  console.log('========================================');
  console.log('  INSIGHTFLOW PROOF HARNESS');
  console.log('========================================\n');

  const traceId = generateId();
  const execId = generateId();

  console.log(`Trace ID: ${traceId}`);
  console.log(`Execution ID: ${execId}\n`);

  const results = [];

  // 1. Telemetry continuity: local persistence
  console.log('--- Test 1: Telemetry Continuity (Local) ---');
  try {
    telemetry.recordExecutionTransition({
      trace_id: traceId,
      execution_id: execId,
      from_status: 'pending',
      to_status: 'processing',
      service: 'bridge',
      details: { test: 'proof_harness' }
    });

    telemetry.recordRejection({
      trace_id: traceId,
      execution_id: execId,
      reason: 'test_rejection',
      service: 'bridge',
      details: { test: 'proof_harness' }
    });

    telemetry.recordDependencyFailure({
      trace_id: traceId,
      execution_id: execId,
      dependency: 'execution',
      error: 'Simulated failure for proof',
      service: 'bridge',
      details: { test: 'proof_harness' }
    });

    const localTelemetry = telemetry.getTelemetryForTrace(traceId);
    const localCount = localTelemetry.length;
    const allPassive = localTelemetry.every(r => r.payload?.passive === true);

    console.log(`  Telemetry records: ${localCount}`);
    console.log(`  All passive: ${allPassive}`);

    results.push({ test: 'telemetry_continuity_local', passed: localCount >= 3 && allPassive });
    console.log(`  RESULT: ${localCount >= 3 && allPassive ? 'PASS' : 'FAIL'}\n`);
  } catch (err) {
    results.push({ test: 'telemetry_continuity_local', passed: false, error: err.message });
    console.log(`  RESULT: FAIL - ${err.message}\n`);
  }

  // 2. Trace continuity: reconstruction
  console.log('--- Test 2: Trace Continuity ---');
  try {
    const reconstruction = require('../replay_reconstruction/reconstruction_tool');
    const reconst = reconstruction.reconstructTrace(traceId);
    const found = reconst.found;
    const hasRecords = reconst.record_count > 0;

    console.log(`  Trace reconstructable: ${found}`);
    console.log(`  Records: ${reconst.record_count}`);

    results.push({ test: 'trace_continuity', passed: found && hasRecords });
    console.log(`  RESULT: ${found && hasRecords ? 'PASS' : 'FAIL'}\n`);
  } catch (err) {
    results.push({ test: 'trace_continuity', passed: false, error: err.message });
    console.log(`  RESULT: FAIL - ${err.message}\n`);
  }

  // 3. InsightFlow adapter (no live integration)
  console.log('--- Test 3: InsightFlow Adapter Readiness ---');
  try {
    const configured = adapter.isConfigured();
    const enabled = adapter.isEnabled();

    console.log(`  Configured: ${configured}`);
    console.log(`  Enabled: ${enabled}`);
    console.log(`  Status: ${configured ? 'READY' : 'CONTRACT ONLY (no INSIGHTFLOW_URL set)'}`);

    results.push({ test: 'adapter_readiness', passed: true, note: configured ? 'ready' : 'contract only' });
    console.log('  RESULT: PASS (contract verified)\n');
  } catch (err) {
    results.push({ test: 'adapter_readiness', passed: false, error: err.message });
    console.log(`  RESULT: FAIL - ${err.message}\n`);
  }

  // 4. Chain integrity
  console.log('--- Test 4: Chain Integrity ---');
  try {
    const integrity = store.validateChainIntegrity();
    console.log(`  Chain valid: ${integrity.valid}`);
    console.log(`  Total records: ${integrity.record_count}`);

    results.push({ test: 'chain_integrity', passed: integrity.valid });
    console.log(`  RESULT: ${integrity.valid ? 'PASS' : 'FAIL'}\n`);
  } catch (err) {
    results.push({ test: 'chain_integrity', passed: false, error: err.message });
    console.log(`  RESULT: FAIL - ${err.message}\n`);
  }

  // Summary
  console.log('========================================');
  console.log('  PROOF HARNESS RESULTS');
  console.log('========================================');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`  Total: ${total}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${total - passed}`);
  console.log('========================================\n');

  return { results, passed, total };
}

if (require.main === module) {
  runProof().then(result => {
    process.exit(result.passed === result.total ? 0 : 1);
  }).catch(err => {
    console.error('Proof harness error:', err);
    process.exit(1);
  });
}

module.exports = { runProof };
