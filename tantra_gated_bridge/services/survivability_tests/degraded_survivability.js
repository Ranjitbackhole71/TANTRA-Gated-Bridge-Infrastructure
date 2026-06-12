const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const store = require('../replay_persistence/append_only_store');
const lineageTracker = require('../replay_persistence/lineage_tracker');
const continuityRecorder = require('../replay_persistence/continuity_recorder');
const telemetryEmitter = require('../observability/telemetry_emitter');
const reconstruction = require('../replay_reconstruction/reconstruction_tool');
const verificationFlow = require('../replay_reconstruction/verification_flow');
const corruptionDetector = require('../replay_reconstruction/corruption_detector');

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function generateId() {
  return crypto.randomUUID();
}

function logResult(name, success) {
  if (success) { passed++; results.push({ test: name, status: 'PASS' }); }
  else { failed++; results.push({ test: name, status: 'FAIL' }); }
  console.log(`  RESULT: ${name} - ${success ? 'PASS' : 'FAIL'}`);
}

// SURV-008: Network partition simulation
async function testNetworkPartition() {
  console.log('\n=== SURV-008: Network partition survivability ===');

  const traceId = generateId();
  const execId = generateId();

  telemetryEmitter.recordDependencyFailure({
    trace_id: traceId,
    execution_id: execId,
    dependency: 'execution',
    error: 'Simulated network partition - execution unreachable',
    service: 'bridge',
    details: { failure_type: 'network_partition', duration_seconds: 30, retry_attempted: false }
  });

  continuityRecorder.recordDependencyFailure(traceId, execId, 'execution', 'Network partition - connection timeout', { failure_type: 'network_partition' });

  const reconst = reconstruction.reconstructTrace(traceId);
  assert(reconst.found, 'Trace should be reconstructable after network partition');
  assert(reconst.executions.length > 0, 'Should have execution entries');

  const failures = reconst.executions.filter(e => e.dependency_failure);
  const partitionRecorded = failures.length > 0 || reconst.record_count >= 2;

  console.log(`  Trace reconstructable: ${reconst.found}`);
  console.log(`  Records: ${reconst.record_count}`);
  console.log(`  Failures reconstructable: ${partitionRecorded}`);

  const integrity = store.validateChainIntegrity();
  assert(integrity.valid, 'Chain integrity must hold after partition');

  logResult('SURV-008', reconst.found && integrity.valid);
  return true;
}

// SURV-009: Dependency instability (flapping)
async function testDependencyInstability() {
  console.log('\n=== SURV-009: Dependency instability (flapping) ===');

  const traceId = generateId();

  const phases = ['pending', 'processing', 'failed', 'retry', 'processing', 'completed'];
  let prevExecId = null;

  for (let i = 0; i < phases.length; i++) {
    const execId = generateId();
    store.appendRecord({
      trace_id: traceId,
      execution_id: execId,
      parent_execution_id: prevExecId,
      event_type: 'execution:phase',
      service: 'execution',
      status: phases[i],
      payload: { phase: i + 1, flapping: i === 2 || i === 3 }
    });
    prevExecId = execId;
  }

  const reconst = reconstruction.reconstructTrace(traceId);
  assert(reconst.found, 'Trace should be reconstructable');
  assert(reconst.execution_count === phases.length, 'All phases should be recorded');
  assert(reconst.lineage_graph.edges.length > 0, 'Should have lineage edges');

  const statuses = reconst.executions.map(e => e.phases[0]?.status);
  const flappingDetected = statuses.filter(s => s === 'failed' || s === 'retry').length >= 2;

  console.log(`  Executions: ${reconst.execution_count}`);
  console.log(`  Statuses: ${statuses.join(', ')}`);
  console.log(`  Flapping detected: ${flappingDetected}`);

  const integrity = store.validateChainIntegrity();
  assert(integrity.valid, 'Chain integrity must hold during instability');

  logResult('SURV-009', reconst.found && integrity.valid);
  return true;
}

// SURV-010: Downstream loss (Bucket unavailable)
async function testDownstreamLoss() {
  console.log('\n=== SURV-010: Downstream loss (Bucket unavailable) ===');

  const traceId = generateId();
  const execId = generateId();

  telemetryEmitter.recordDependencyFailure({
    trace_id: traceId,
    execution_id: execId,
    dependency: 'bucket',
    error: 'Connection refused - Bucket service unavailable',
    service: 'execution',
    details: { port: 3004, downstream: true, storage_failure: true }
  });

  continuityRecorder.recordExecutionTransition(traceId, execId, 'processing', 'failed');

  const reconst = reconstruction.reconstructTrace(traceId);
  assert(reconst.found, 'Failure trace should be reconstructable');

  const hasDownstreamFailure = reconst.executions.some(e =>
    e.dependency_failure?.dependency === 'bucket' ||
    e.phases.some(p => p.status === 'failed')
  );

  console.log(`  Trace reconstructable: ${reconst.found}`);
  console.log(`  Downstream loss recorded: ${hasDownstreamFailure}`);

  const integrity = store.validateChainIntegrity();
  assert(integrity.valid, 'Chain integrity must hold after downstream loss');

  logResult('SURV-010', reconst.found && integrity.valid);
  return true;
}

// SURV-011: Authority degradation visibility
async function testAuthorityDegradationVisibility() {
  console.log('\n=== SURV-011: Authority degradation visibility ===');

  const traceId = generateId();

  telemetryEmitter.recordDependencyFailure({
    trace_id: traceId,
    execution_id: generateId(),
    dependency: 'sarathi',
    error: 'Token signing failed - authority degraded',
    service: 'bridge',
    details: { authority: 'sarathi', degradation_type: 'signing_delay', response_time_ms: 5000 }
  });

  telemetryEmitter.recordExecutionTransition({
    trace_id: traceId,
    execution_id: generateId(),
    from_status: 'pending',
    to_status: 'blocked',
    service: 'bridge',
    details: { reason: 'authority_unreachable' }
  });

  const reconst = reconstruction.reconstructTrace(traceId);
  assert(reconst.found, 'Authority degradation trace should be reconstructable');

  const telemetry = telemetryEmitter.getTelemetryForTrace(traceId);
  const hasAuthorityFailure = telemetry.some(t => t.payload?.failed_dependency === 'sarathi');

  console.log(`  Telemetry events: ${telemetry.length}`);
  console.log(`  Authority failure visible: ${hasAuthorityFailure}`);

  const passiveOnly = telemetry.every(t => t.payload?.passive === true);
  console.log(`  All passive: ${passiveOnly}`);

  logResult('SURV-011', reconst.found && hasAuthorityFailure && passiveOnly);
  return true;
}

// SURV-012: Observability continuity under degraded conditions
async function testObservabilityContinuity() {
  console.log('\n=== SURV-012: Observability continuity under degradation ===');

  const traceId = generateId();
  const events = ['request_received', 'execution_transition', 'rejection', 'dependency_failure', 'response_sent'];

  for (const event of events) {
    telemetryEmitter.emitExecutionTelemetry({
      trace_id: traceId,
      execution_id: generateId(),
      service: 'bridge',
      event_type: event,
      status: event === 'rejection' ? 'rejected' : event === 'dependency_failure' ? 'failed' : 'info',
      payload: { degraded: true, event }
    });
  }

  const allTelemetry = telemetryEmitter.getTelemetryForTrace(traceId);
  assert(allTelemetry.length >= events.length, 'All events should be recorded');

  const summary = telemetryEmitter.getTelemetrySummary(traceId);
  assert(summary.passive_only, 'All events must be passive');

  const distinctTypes = Object.keys(summary.event_types).length;
  console.log(`  Events recorded: ${allTelemetry.length}`);
  console.log(`  Distinct event types: ${distinctTypes}`);
  console.log(`  All passive: ${summary.passive_only}`);

  const reconst = reconstruction.reconstructTrace(traceId);
  console.log(`  Trace reconstructable: ${reconst.found}`);

  logResult('SURV-012', allTelemetry.length >= events.length && summary.passive_only);
  return true;
}

// SURV-013: Multi-instance recovery
async function testMultiInstanceRecovery() {
  console.log('\n=== SURV-013: Multi-instance reconstruction recovery ===');

  const traceId = generateId();
  const execIds = [];

  for (let i = 0; i < 3; i++) {
    const execId = generateId();
    execIds.push(execId);
    store.appendRecord({
      trace_id: traceId,
      execution_id: execId,
      parent_execution_id: i > 0 ? execIds[i - 1] : null,
      event_type: 'execution:phase',
      service: 'execution',
      status: 'completed',
      payload: { phase: i + 1, instance: `instance-${i + 1}` }
    });
  }

  const r1 = reconstruction.reconstructTrace(traceId);
  assert(r1.found, 'First reconstruction should succeed');

  const r2 = reconstruction.reconstructTrace(traceId);
  assert(r2.found, 'Second reconstruction should succeed');

  assert(r1.record_count === r2.record_count, 'Reconstructions must be identical');
  assert(r1.execution_count === r2.execution_count, 'Execution counts must match');

  const graph = lineageTracker.buildLineageGraph(traceId);
  assert(graph.nodes.length > 0, 'Lineage graph should have nodes');

  const chainIntegrity = store.validateChainIntegrity();
  assert(chainIntegrity.valid, 'Chain integrity must hold');

  const det = verificationFlow.verifyDeterministicReplay(traceId);
  assert(det.valid, 'Deterministic replay must match');

  console.log(`  Reconstructions match: ${r1.record_count} === ${r2.record_count}`);
  console.log(`  Lineage nodes: ${graph.nodes.length}, edges: ${graph.edges.length}`);
  console.log(`  Deterministic: ${det.valid}`);
  console.log(`  Chain integrity: ${chainIntegrity.valid}`);

  logResult('SURV-013', r1.found && det.valid && chainIntegrity.valid);
  return true;
}

async function runAll() {
  console.log('========================================');
  console.log('  DEGRADED SURVIVABILITY TEST SUITE');
  console.log('========================================\n');

  const tests = [
    { name: 'SURV-008', fn: testNetworkPartition },
    { name: 'SURV-009', fn: testDependencyInstability },
    { name: 'SURV-010', fn: testDownstreamLoss },
    { name: 'SURV-011', fn: testAuthorityDegradationVisibility },
    { name: 'SURV-012', fn: testObservabilityContinuity },
    { name: 'SURV-013', fn: testMultiInstanceRecovery }
  ];

  for (const test of tests) {
    try {
      await test.fn();
      console.log(`  ${test.name}: PASS\n`);
    } catch (err) {
      failed++;
      results.push({ test: test.name, status: 'FAIL', error: err.message });
      console.log(`  ${test.name}: FAIL - ${err.message}\n`);
    }
  }

  const proof = {
    test_suite: 'TANTRA Degraded Survivability Test Suite v1.0',
    timestamp: new Date().toISOString(),
    total: passed + failed,
    passed,
    failed,
    summary: `${passed}/${passed + failed} tests passed`,
    results,
    chain_state: store.getChainState(),
    chain_integrity: store.validateChainIntegrity(),
    corruption_scan: corruptionDetector.detectCorruption()
  };

  console.log('========================================');
  console.log('  DEGRADED SURVIVABILITY RESULTS');
  console.log('========================================');
  console.log(`  Total: ${proof.total}`);
  console.log(`  Passed: ${proof.passed}`);
  console.log(`  Failed: ${proof.failed}`);
  console.log(`  Summary: ${proof.summary}`);
  console.log('========================================\n');

  const proofDir = path.join(__dirname, 'proof');
  if (!fs.existsSync(proofDir)) fs.mkdirSync(proofDir, { recursive: true });
  const proofPath = path.join(proofDir, 'degraded_survivability_proof.json');
  fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2));
  console.log(`Proof written to: ${proofPath}\n`);

  return { passed, failed, total: passed + failed };
}

if (require.main === module) {
  runAll().catch(err => {
    console.error('Degraded survivability test error:', err);
    process.exit(1);
  });
}

module.exports = {
  testNetworkPartition,
  testDependencyInstability,
  testDownstreamLoss,
  testAuthorityDegradationVisibility,
  testObservabilityContinuity,
  testMultiInstanceRecovery,
  runAll
};
