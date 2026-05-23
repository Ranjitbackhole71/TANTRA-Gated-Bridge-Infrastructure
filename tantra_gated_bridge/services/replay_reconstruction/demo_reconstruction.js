const store = require('../replay_persistence/append_only_store');
const reconstruction = require('./reconstruction_tool');
const verification = require('./verification_flow');
const corruption = require('./corruption_detector');
const lineageGraph = require('./lineage_graph');

function runDemo() {
  console.log('========================================');
  console.log('  TANTRA Replay Reconstruction Demo');
  console.log('========================================\n');

  const chainState = store.getChainState();
  console.log(`Chain state: ${chainState.record_count} records, last hash: ${chainState.last_hash?.slice(0, 16)}...\n`);

  const allRecords = store.getAllRecords();
  const traceIds = [...new Set(allRecords.map(r => r.trace_id))];
  console.log(`Available traces: ${traceIds.length}\n`);

  for (const traceId of traceIds.slice(0, 3)) {
    console.log(`--- Trace: ${traceId.slice(0, 8)}... ---`);
    const reconst = reconstruction.reconstructTrace(traceId);
    console.log(`  Found: ${reconst.found}`);
    if (reconst.found) {
      console.log(`  Executions: ${reconst.execution_count}`);
      console.log(`  Records: ${reconst.record_count}`);
      console.log(`  Lineage edges: ${reconst.lineage_graph?.edges?.length || 0}`);
      console.log(`  Continuity phases: ${reconst.continuity?.phases?.join(', ') || 'none'}`);
    }
    console.log('');
  }

  console.log('--- Full Verification ---');
  const integrity = store.validateChainIntegrity();
  console.log(`Chain integrity: ${integrity.valid ? 'PASS' : 'FAIL'}`);

  const corruptionScan = corruption.detectCorruption();
  console.log(`Corruption: ${corruptionScan.corrupted ? `DETECTED (${corruptionScan.corruption_count} issues)` : 'NONE'}`);

  const depth = lineageGraph.getLineageDepth();
  console.log(`Lineage depth: max=${depth.max_depth}, avg=${depth.average_depth.toFixed(1)}, total_nodes=${depth.total_nodes}`);

  console.log('\n--- Deterministic Replay ---');
  if (traceIds.length > 0) {
    const det = verification.verifyDeterministicReplay(traceIds[0]);
    console.log(`Trace ${traceIds[0].slice(0, 8)}... deterministic: ${det.valid}`);
  }

  console.log('\n========================================');
  console.log('  RECONSTRUCTION DEMO COMPLETE');
  console.log('========================================');
}

if (require.main === module) {
  runDemo();
}

module.exports = { runDemo };
