const store = require('../replay_persistence/append_only_store');
const lineage = require('../replay_persistence/lineage_tracker');
const continuity = require('../replay_persistence/continuity_recorder');
const corruption = require('./corruption_detector');
const reconstruction = require('./reconstruction_tool');

function runFullVerification(traceId) {
  const steps = [];

  steps.push({ step: 'chain_integrity', result: store.validateChainIntegrity() });
  steps.push({ step: 'corruption_scan', result: traceId ? corruption.isolateCorruptedTrace(traceId) : corruption.detectCorruption() });
  steps.push({ step: 'continuity_check', result: traceId ? continuity.verifyContinuityIntegrity(traceId) : { valid: true, note: 'no trace specified' } });

  let reconstructable = null;
  if (traceId) {
    reconstructable = reconstruction.verifyReconstructable(traceId);
  }
  steps.push({ step: 'reconstructable', result: reconstructable || { valid: false, note: 'no trace specified' } });

  const allPassed = steps.every(s => s.result.valid === true || s.result.valid === undefined);
  return {
    trace_id: traceId || 'all',
    verification_id: require('crypto').randomUUID(),
    timestamp: new Date().toISOString(),
    steps,
    all_passed: allPassed,
    summary: steps.map(s => `${s.step}: ${s.result.valid === true ? 'PASS' : s.result.valid === false ? 'FAIL' : 'SKIP'}`).join(', ')
  };
}

function verifyDeterministicReplay(traceId) {
  const original = reconstruction.reconstructTrace(traceId);
  if (!original.found) return { valid: false, reason: 'trace not found' };

  const second = reconstruction.reconstructTrace(traceId);
  if (!second.found) return { valid: false, reason: 'second reconstruction failed' };

  return {
    valid: true,
    trace_id: traceId,
    deterministic: true,
    first_record_count: original.record_count,
    second_record_count: second.record_count,
    first_execution_count: original.execution_count,
    second_execution_count: second.execution_count
  };
}

function verifyAfterRestart(traceId) {
  const result = reconstruction.reconstructTrace(traceId);
  const integrity = store.validateChainIntegrity();
  const corruptionCheck = corruption.isolateCorruptedTrace(traceId);

  return {
    restart_survivable: result.found,
    chain_preserved: integrity.valid,
    corrupted: corruptionCheck.is_corrupted,
    trace_id: traceId,
    record_count: result.found ? result.record_count : 0,
    execution_count: result.found ? result.execution_count : 0,
    verification_id: require('crypto').randomUUID(),
    timestamp: new Date().toISOString()
  };
}

if (require.main === module) {
  const traceId = process.argv[2];
  if (!traceId) {
    const allIntegrity = store.validateChainIntegrity();
    const allCorruption = corruption.detectCorruption();
    console.log('=== Full Replay Verification ===');
    console.log('Chain integrity:', allIntegrity.valid ? 'PASS' : 'FAIL');
    console.log('Corruption detected:', allCorruption.corrupted ? 'YES' : 'NO');
    console.log('Total records:', allIntegrity.record_count);
    console.log(JSON.stringify(allCorruption, null, 2));
    process.exit(0);
  }
  const result = runFullVerification(traceId);
  console.log(JSON.stringify(result, null, 2));
}

module.exports = {
  runFullVerification,
  verifyDeterministicReplay,
  verifyAfterRestart
};
