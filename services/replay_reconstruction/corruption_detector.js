const store = require('../replay_persistence/append_only_store');
const lineage = require('../replay_persistence/lineage_tracker');

function detectCorruption() {
  const results = [];
  const chainIntegrity = store.validateChainIntegrity();

  if (!chainIntegrity.valid) {
    for (const err of chainIntegrity.errors) {
      results.push({
        type: 'chain_integrity',
        severity: 'critical',
        index: err.index,
        trace_id: err.trace_id,
        issue: err.issue,
        details: err
      });
    }
  }

  const allRecords = store.getAllRecords();
  const recordsByTrace = new Map();
  for (const record of allRecords) {
    if (!recordsByTrace.has(record.trace_id)) {
      recordsByTrace.set(record.trace_id, []);
    }
    recordsByTrace.get(record.trace_id).push(record);
  }

  for (const [traceId, records] of recordsByTrace) {
    const missingParent = [];
    for (let i = 1; i < records.length; i++) {
      if (records[i].parent_hash !== records[i - 1].hash) {
        missingParent.push({
          index: i,
          record_hash: records[i].hash,
          expected_parent: records[i - 1].hash
        });
      }
    }

    if (missingParent.length > 0) {
      results.push({
        type: 'broken_lineage',
        severity: 'high',
        trace_id: traceId,
        gaps: missingParent
      });
    }

    const hashSet = new Map();
    for (const record of records) {
      if (hashSet.has(record.hash)) {
        results.push({
          type: 'duplicate_hash',
          severity: 'high',
          trace_id: traceId,
          hash: record.hash,
          first: hashSet.get(record.hash),
          duplicate: record
        });
      }
      hashSet.set(record.hash, record);
    }
  }

  const orphans = [];
  for (const record of allRecords) {
    if (record.parent_hash && record.parent_hash !== null) {
      const parentExists = allRecords.some(r => r.hash === record.parent_hash);
      if (!parentExists) {
        orphans.push({
          type: 'orphan_record',
          severity: 'critical',
          trace_id: record.trace_id,
          execution_id: record.execution_id,
          hash: record.hash,
          missing_parent: record.parent_hash
        });
      }
    }
  }
  results.push(...orphans);

  return {
    corrupted: results.length > 0,
    corruption_count: results.length,
    severity_counts: {
      critical: results.filter(r => r.severity === 'critical').length,
      high: results.filter(r => r.severity === 'high').length,
      medium: results.filter(r => r.severity === 'medium').length,
      low: results.filter(r => r.severity === 'low').length
    },
    findings: results
  };
}

function isolateCorruptedTrace(traceId) {
  const integrity = store.validateChainIntegrity();
  const detection = detectCorruption();
  const traceFindings = detection.findings.filter(f =>
    f.trace_id === traceId || (f.details && f.details.trace_id === traceId)
  );

  return {
    trace_id: traceId,
    is_corrupted: traceFindings.length > 0,
    chain_integrity_valid: integrity.valid,
    findings: traceFindings,
    finding_count: traceFindings.length,
    isolated: traceFindings.length > 0
  };
}

function verifyArtifactChain(records) {
  const errors = [];
  let previousHash = null;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const computedHash = store.computeHash(record);

    if (record.hash !== computedHash) {
      errors.push({ index: i, expected: computedHash, got: record.hash, issue: 'hash_mismatch' });
    }
    if (i > 0 && record.parent_hash !== previousHash) {
      errors.push({ index: i, expected_parent: previousHash, got: record.parent_hash, issue: 'parent_break' });
    }
    if (i === 0 && record.parent_hash !== null) {
      errors.push({ index: 0, issue: 'root_has_parent' });
    }
    previousHash = record.hash;
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  detectCorruption,
  isolateCorruptedTrace,
  verifyArtifactChain
};
