const adapter = require('./adapter');

function checkReadiness() {
  console.log('========================================');
  console.log('  INSIGHTFLOW READINESS CHECK');
  console.log('========================================\n');

  const checks = [];

  // 1. Adapter module
  console.log('--- Check 1: Adapter Module ---');
  try {
    const hasEmitTransition = typeof adapter.emitExecutionTransition === 'function';
    const hasEmitRejection = typeof adapter.emitRejection === 'function';
    const hasEmitDependency = typeof adapter.emitDependencyFailure === 'function';
    const hasForward = typeof adapter.forward === 'function';
    const allExports = hasEmitTransition && hasEmitRejection && hasEmitDependency && hasForward;

    checks.push({ check: 'adapter_exports', passed: allExports });
    console.log(`  All functions exported: ${allExports ? 'YES' : 'NO'}`);
    console.log('  RESULT: ' + (allExports ? 'PASS' : 'FAIL') + '\n');
  } catch (err) {
    checks.push({ check: 'adapter_exports', passed: false, error: err.message });
    console.log('  RESULT: FAIL - ' + err.message + '\n');
  }

  // 2. Configuration
  console.log('--- Check 2: Configuration ---');
  try {
    const configured = adapter.isConfigured();
    const enabled = adapter.isEnabled();

    checks.push({ check: 'configuration', passed: true });
    console.log(`  INSIGHTFLOW_URL: ${process.env.INSIGHTFLOW_URL || '(not set)'}`);
    console.log(`  INSIGHTFLOW_API_KEY: ${process.env.INSIGHTFLOW_API_KEY ? '(set)' : '(not set)'}`);
    console.log(`  INSIGHTFLOW_ENABLED: ${process.env.INSIGHTFLOW_ENABLED || 'false'}`);
    console.log(`  Status: ${configured ? 'READY - will forward telemetry' : 'CONTRACT ONLY - set INSIGHTFLOW_URL to enable'}`);
    console.log('  RESULT: PASS\n');
  } catch (err) {
    checks.push({ check: 'configuration', passed: false, error: err.message });
    console.log('  RESULT: FAIL - ' + err.message + '\n');
  }

  // 3. Passive guarantee
  console.log('--- Check 3: Passive Guarantee ---');
  try {
    const adapterSource = require('fs').readFileSync(__dirname + '/adapter.js', 'utf-8');
    const hasPassiveTag = adapterSource.includes('passive: true');
    const hasNoTokenGen = !adapterSource.includes('jwt.sign') && !adapterSource.includes('generateToken');
    const hasNoExecution = !adapterSource.includes('executeWorkload') && !adapterSource.includes('spawn');

    checks.push({ check: 'passive_guarantee', passed: hasPassiveTag && hasNoTokenGen && hasNoExecution });
    console.log(`  Passive tag present: ${hasPassiveTag ? 'YES' : 'NO'}`);
    console.log(`  No token generation: ${hasNoTokenGen ? 'YES' : 'NO'}`);
    console.log(`  No execution logic: ${hasNoExecution ? 'YES' : 'NO'}`);
    console.log('  RESULT: ' + (hasPassiveTag && hasNoTokenGen && hasNoExecution ? 'PASS' : 'FAIL') + '\n');
  } catch (err) {
    checks.push({ check: 'passive_guarantee', passed: false, error: err.message });
    console.log('  RESULT: FAIL - ' + err.message + '\n');
  }

  // 4. Observability integration
  console.log('--- Check 4: Observability Backend ---');
  try {
    const telemetryEmitter = require.resolve('../observability/telemetry_emitter');
    const traceCollector = require.resolve('../observability/trace_collector');

    checks.push({ check: 'observability_backend', passed: true });
    console.log(`  telemetry_emitter.js: ${require('fs').existsSync(telemetryEmitter)}`);
    console.log(`  trace_collector.js: ${require('fs').existsSync(traceCollector)}`);
    console.log('  RESULT: PASS\n');
  } catch (err) {
    checks.push({ check: 'observability_backend', passed: false, error: err.message });
    console.log('  RESULT: FAIL - ' + err.message + '\n');
  }

  // Summary
  console.log('========================================');
  console.log('  READINESS CHECK RESULTS');
  console.log('========================================');
  const passed = checks.filter(c => c.passed).length;
  const total = checks.length;
  console.log(`  Total checks: ${total}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${total - passed}`);
  console.log(`  Integration ready: ${passed === total ? 'YES' : 'NO'}`);
  console.log('========================================\n');

  return { checks, passed, total };
}

if (require.main === module) {
  const result = checkReadiness();
  process.exit(result.passed === result.total ? 0 : 1);
}

module.exports = { checkReadiness };
