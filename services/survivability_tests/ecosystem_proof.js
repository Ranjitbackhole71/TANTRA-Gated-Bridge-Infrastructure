const store = require('../replay_persistence/append_only_store');
const reconstruction = require('../replay_reconstruction/reconstruction_tool');
const telemetry = require('../observability/telemetry_emitter');
const corruption = require('../replay_reconstruction/corruption_detector');
const verification = require('../replay_reconstruction/verification_flow');

const results = [];
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

async function runEcosystemProof() {
  const allRecords = store.getAllRecords();
  const telemetryRecords = allRecords.filter(r => r.event_type?.startsWith('telemetry:'));
  const traceRecords = allRecords.filter(r => r.event_type?.startsWith('trace:'));

  console.log('=== TANTRA Ecosystem Participation Proof ===\n');

  // OBS-CORE-001: All telemetry events tagged passive:true
  try {
    const allPassive = telemetryRecords.every(r => r.payload?.passive === true);
    assert(allPassive, 'Some telemetry events missing passive:true');
    results.push({ contract: 'OBS-CORE-001', test: 'Telemetry events tagged passive:true', passed: true });
    passed++;
    console.log('  PASS: OBS-CORE-001 - All telemetry events tagged passive:true');
  } catch (err) {
    results.push({ contract: 'OBS-CORE-001', test: 'Telemetry events tagged passive:true', passed: false, error: err.message });
    failed++;
    console.log(`  FAIL: OBS-CORE-001 - ${err.message}`);
  }

  // TEL-EXPORT-001: All records parseable with required fields
  try {
    const allValid = allRecords.every(r => r && r.trace_id && r.event_type && r.service && r.status);
    assert(allValid, 'Some records missing required fields');
    const hasValidTypes = allRecords.every(r =>
      !r.event_type.startsWith('telemetry:') ||
      (r.payload && r.payload.telemetry === true && r.payload.passive === true)
    );
    assert(hasValidTypes, 'Some telemetry events have invalid payload');
    results.push({ contract: 'TEL-EXPORT-001', test: 'All records parseable with valid schema', passed: true });
    passed++;
    console.log('  PASS: TEL-EXPORT-001 - All records parseable with valid schema');
  } catch (err) {
    results.push({ contract: 'TEL-EXPORT-001', test: 'All records parseable with valid schema', passed: false, error: err.message });
    failed++;
    console.log(`  FAIL: TEL-EXPORT-001 - ${err.message}`);
  }

  // TRC-CONT-001: Chain integrity valid
  try {
    const integrity = store.validateChainIntegrity();
    assert(integrity.valid, `Chain integrity broken: ${JSON.stringify(integrity.errors)}`);
    assert(integrity.record_count > 0, 'No records in chain');
    results.push({ contract: 'TRC-CONT-001', test: 'Chain integrity valid', passed: true });
    passed++;
    console.log(`  PASS: TRC-CONT-001 - Chain integrity valid (${integrity.record_count} records)`);
  } catch (err) {
    results.push({ contract: 'TRC-CONT-001', test: 'Chain integrity valid', passed: false, error: err.message });
    failed++;
    console.log(`  FAIL: TRC-CONT-001 - ${err.message}`);
  }

  // TRC-CONT-002: Reconstruction is read-only (no file modification)
  try {
    const chainStateBefore = store.getChainState();
    if (allRecords.length > 0) {
      const traceId = allRecords[0].trace_id;
      const result = reconstruction.reconstructTrace(traceId);
      assert(result.found !== undefined, 'Reconstruction returned invalid result');
    }
    const chainStateAfter = store.getChainState();
    assert(
      chainStateBefore.record_count === chainStateAfter.record_count,
      'Reconstruction modified chain state'
    );
    results.push({ contract: 'TRC-CONT-002', test: 'Reconstruction is read-only', passed: true });
    passed++;
    console.log('  PASS: TRC-CONT-002 - Reconstruction is read-only');
  } catch (err) {
    results.push({ contract: 'TRC-CONT-002', test: 'Reconstruction is read-only', passed: false, error: err.message });
    failed++;
    console.log(`  FAIL: TRC-CONT-002 - ${err.message}`);
  }

  // REP-COMPAT-001: All records have valid SHA-256 hashes
  try {
    const hashValid = allRecords.every(r => r.hash && /^[a-f0-9]{64}$/.test(r.hash));
    assert(hashValid, 'Some records have invalid hash format');
    results.push({ contract: 'REP-COMPAT-001', test: 'All records have valid SHA-256 hashes', passed: true });
    passed++;
    console.log('  PASS: REP-COMPAT-001 - All records have valid SHA-256 hashes');
  } catch (err) {
    results.push({ contract: 'REP-COMPAT-001', test: 'All records have valid SHA-256 hashes', passed: false, error: err.message });
    failed++;
    console.log(`  FAIL: REP-COMPAT-001 - ${err.message}`);
  }

  // Deterministic replay consistency
  try {
    if (allRecords.length > 0) {
      const traceId = allRecords.find(r => r.trace_id)?.trace_id;
      if (traceId) {
        const detResult = verification.verifyDeterministicReplay(traceId);
        assert(detResult.deterministic, 'Replay is not deterministic');
        results.push({ contract: 'TRC-CONT-001b', test: 'Deterministic replay verified', passed: true });
        passed++;
        console.log('  PASS: TRC-CONT-001b - Deterministic replay verified');
      }
    }
  } catch (err) {
    results.push({ contract: 'TRC-CONT-001b', test: 'Deterministic replay verified', passed: false, error: err.message });
    failed++;
    console.log(`  FAIL: TRC-CONT-001b - ${err.message}`);
  }

  // Passive guarantee: no telemetry record has execution authority
  try {
    const noExecAuthority = telemetryRecords.every(r =>
      r.event_type.startsWith('telemetry:') &&
      r.payload?.passive === true &&
      r.payload?.telemetry === true
    );
    assert(noExecAuthority, 'Some telemetry records have execution authority');
    results.push({ contract: 'OBS-CORE-002', test: 'No telemetry event has execution authority', passed: true });
    passed++;
    console.log('  PASS: OBS-CORE-002 - No telemetry event has execution authority');
  } catch (err) {
    results.push({ contract: 'OBS-CORE-002', test: 'No telemetry event has execution authority', passed: false, error: err.message });
    failed++;
    console.log(`  FAIL: OBS-CORE-002 - ${err.message}`);
  }

  // Summary
  console.log('\n========================================');
  console.log('  ECOSYSTEM PARTICIPATION PROOF');
  console.log('========================================');
  console.log(`  Contracts verified: ${results.length}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Summary: ${passed}/${results.length} contracts active`);
  console.log('========================================\n');

  const proof = {
    test_suite: 'TANTRA Ecosystem Participation Proof v1.0',
    timestamp: new Date().toISOString(),
    total: results.length,
    passed,
    failed,
    summary: `${passed}/${results.length} contracts active`,
    contracts: results,
    chain_state: store.getChainState(),
    chain_integrity: store.validateChainIntegrity()
  };

  const fs = require('fs');
  const path = require('path');
  const proofDir = path.join(__dirname, 'proof');
  if (!fs.existsSync(proofDir)) fs.mkdirSync(proofDir, { recursive: true });
  fs.writeFileSync(
    path.join(proofDir, 'ecosystem_proof.json'),
    JSON.stringify(proof, null, 2),
    'utf-8'
  );
  console.log(`Proof written to: ${path.join(proofDir, 'ecosystem_proof.json')}`);

  process.exit(failed > 0 ? 1 : 0);
}

runEcosystemProof().catch(err => {
  console.error('Ecosystem proof error:', err);
  process.exit(1);
});
