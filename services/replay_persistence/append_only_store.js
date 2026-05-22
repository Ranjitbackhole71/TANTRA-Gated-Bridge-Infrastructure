const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const STORAGE_DIR = process.env.REPLAY_STORAGE_DIR || path.join(__dirname, 'data');
const MAX_RECORD_SIZE = 1024 * 1024;

if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

const logFile = path.join(STORAGE_DIR, 'replay_log.jsonl');
const chainFile = path.join(STORAGE_DIR, 'replay_chain.json');

function now() {
  return new Date().toISOString();
}

function loadChainState() {
  try {
    if (fs.existsSync(chainFile)) {
      return JSON.parse(fs.readFileSync(chainFile, 'utf-8'));
    }
  } catch (e) {}
  return { last_hash: null, record_count: 0 };
}

function saveChainState(state) {
  fs.writeFileSync(chainFile, JSON.stringify(state, null, 2), 'utf-8');
}

function computeHash(record) {
  const hashInput = JSON.parse(JSON.stringify(record));
  delete hashInput.hash;
  const serialized = JSON.stringify(hashInput, Object.keys(hashInput).sort());
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

function appendRecord(record) {
  if (!record.trace_id) throw new Error('trace_id required');
  if (!record.event_type) throw new Error('event_type required');

  const chainState = loadChainState();
  const recordEntry = {
    trace_id: record.trace_id,
    execution_id: record.execution_id || null,
    parent_execution_id: record.parent_execution_id || null,
    event_type: record.event_type,
    service: record.service || 'unknown',
    status: record.status || 'unknown',
    payload: record.payload || {},
    timestamp: record.timestamp || now(),
    parent_hash: chainState.last_hash,
    sequence: chainState.record_count + 1,
    host: os.hostname()
  };

  const hash = computeHash(recordEntry);
  recordEntry.hash = hash;

  const line = JSON.stringify(recordEntry) + '\n';
  if (Buffer.byteLength(line, 'utf-8') > MAX_RECORD_SIZE) {
    throw new Error('Record exceeds max size');
  }

  fs.appendFileSync(logFile, line, 'utf-8');
  chainState.last_hash = hash;
  chainState.record_count += 1;
  saveChainState(chainState);

  return recordEntry;
}

function getAllRecords() {
  const records = [];
  if (!fs.existsSync(logFile)) return records;
  const lines = fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean);
  for (const line of lines) {
    try { records.push(JSON.parse(line)); } catch (e) {}
  }
  return records;
}

function getRecordsByTraceId(traceId) {
  return getAllRecords().filter(r => r.trace_id === traceId);
}

function getRecordsByExecutionId(executionId) {
  return getAllRecords().filter(r => r.execution_id === executionId);
}

function getChainState() {
  return loadChainState();
}

function validateChainIntegrity() {
  const errors = [];
  const records = getAllRecords();
  let previousHash = null;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const storedHash = record.hash;
    const computedHash = computeHash(record);

    if (storedHash !== computedHash) {
      errors.push({ index: i, trace_id: record.trace_id, issue: 'hash_mismatch' });
    }
    if (i === 0 && record.parent_hash !== null) {
      errors.push({ index: i, trace_id: record.trace_id, issue: 'first_record_has_parent' });
    }
    if (i > 0 && record.parent_hash !== previousHash) {
      errors.push({ index: i, trace_id: record.trace_id, issue: 'parent_hash_break', expected: previousHash, got: record.parent_hash });
    }
    previousHash = storedHash;
  }

  return { valid: errors.length === 0, record_count: records.length, errors };
}

module.exports = {
  appendRecord,
  getAllRecords,
  getRecordsByTraceId,
  getRecordsByExecutionId,
  getChainState,
  validateChainIntegrity,
  computeHash,
  STORAGE_DIR,
  logFile
};
