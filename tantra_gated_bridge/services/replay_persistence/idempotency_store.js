const store = require('./append_only_store');

const processedIds = new Set();

function isProcessed(idempotencyKey) {
  if (processedIds.has(idempotencyKey)) return true;
  const records = store.getAllRecords();
  for (const record of records) {
    if (record.payload?.idempotency_key === idempotencyKey) {
      processedIds.add(idempotencyKey);
      return true;
    }
  }
  return false;
}

function markProcessed(opts) {
  const { trace_id, execution_id, idempotency_key, service, status, result } = opts;
  if (processedIds.has(idempotency_key)) {
    return { duplicate: true, idempotency_key };
  }
  const record = store.appendRecord({
    trace_id,
    execution_id,
    parent_execution_id: null,
    event_type: 'idempotency',
    service: service || 'unknown',
    status: status || 'processed',
    payload: { idempotency_key, result: result || {} }
  });
  processedIds.add(idempotency_key);
  return { duplicate: false, record };
}

function findDuplicateRecords(traceId) {
  const records = store.getRecordsByTraceId(traceId);
  const keyMap = new Map();
  const duplicates = [];

  for (const record of records) {
    const key = record.payload?.idempotency_key;
    if (key) {
      if (keyMap.has(key)) {
        duplicates.push({
          idempotency_key: key,
          first: keyMap.get(key),
          duplicate: record
        });
      } else {
        keyMap.set(key, record);
      }
    }
  }

  return { trace_id: traceId, duplicates, total_duplicates: duplicates.length };
}

function warmCache() {
  const records = store.getAllRecords();
  let warmed = 0;
  for (const record of records) {
    const key = record.payload?.idempotency_key;
    if (key && !processedIds.has(key)) {
      processedIds.add(key);
      warmed++;
    }
  }
  return { cached: processedIds.size, warmed };
}

function resetMemoryCache() {
  processedIds.clear();
}

// Warm cache on module load for restart survivability
warmCache();

module.exports = {
  isProcessed,
  markProcessed,
  findDuplicateRecords,
  resetMemoryCache,
  warmCache
};
