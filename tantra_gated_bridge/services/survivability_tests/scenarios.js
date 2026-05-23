const crypto = require('crypto');

const SCENARIOS = {
  BRIDGE_RESTART_DURING_EXECUTION: {
    id: 'SURV-001',
    name: 'Bridge restart during execution',
    description: 'Verify replay persistence survives Bridge service restart mid-execution',
    critical: true
  },
  BUCKET_RESTART_DURING_REPLAY: {
    id: 'SURV-002',
    name: 'Bucket restart during replay verification',
    description: 'Verify Bucket restart does not corrupt replay verification state',
    critical: true
  },
  REPLAY_RECONSTRUCTION_AFTER_RESTART: {
    id: 'SURV-003',
    name: 'Replay reconstruction after restart',
    description: 'Verify full replay reconstruction succeeds after all services restart',
    critical: true
  },
  CORRUPTED_LINEAGE_ISOLATION: {
    id: 'SURV-004',
    name: 'Corrupted lineage isolation',
    description: 'Verify corrupted lineage records are detected and isolated without affecting valid records',
    critical: true
  },
  CONCURRENT_REPLAY_CHAIN_VALIDATION: {
    id: 'SURV-005',
    name: 'Concurrent replay-chain validation',
    description: 'Verify multiple replay chains can be validated concurrently without interference',
    critical: false
  },
  SERVICE_UNAVAILABILITY_PROPAGATION: {
    id: 'SURV-006',
    name: 'Service unavailability propagation',
    description: 'Verify failure propagation is correctly recorded when services are unavailable',
    critical: true
  },
  TRACE_CONTINUITY_DEGRADED: {
    id: 'SURV-007',
    name: 'Trace continuity under degraded conditions',
    description: 'Verify trace continuity is maintained under degraded network/processing conditions',
    critical: false
  }
};

function generateTestTraceId() {
  return crypto.randomUUID();
}

function generateTestExecutionId() {
  return crypto.randomUUID();
}

function createSimulatedRecords(store, count, traceId, startStatus) {
  const records = [];
  const statuses = ['pending', 'processing', 'completed'];
  for (let i = 0; i < count; i++) {
    const record = store.appendRecord({
      trace_id: traceId,
      execution_id: crypto.randomUUID(),
      parent_execution_id: i > 0 ? records[i - 1]?.execution_id || null : null,
      event_type: 'test_event',
      service: 'test',
      status: statuses[i % statuses.length],
      payload: { sequence: i, simulated: true }
    });
    records.push(record);
  }
  return records;
}

module.exports = { SCENARIOS, generateTestTraceId, generateTestExecutionId, createSimulatedRecords };
