const store = require('./append_only_store');

const processedJtis = new Set();

function warmJtiCache() {
  const records = store.getAllRecords();
  let warmed = 0;
  for (const record of records) {
    if (record.event_type === 'jti_used' && record.payload && record.payload.jti) {
      if (!processedJtis.has(record.payload.jti)) {
        processedJtis.add(record.payload.jti);
        warmed++;
      }
    }
  }
  return { cached: processedJtis.size, warmed };
}

function hasJti(jti) {
  return processedJtis.has(jti);
}

function recordJti(opts) {
  const { trace_id, execution_id, jti } = opts;
  if (processedJtis.has(jti)) {
    return { duplicate: true, jti };
  }
  const record = store.appendRecord({
    trace_id: trace_id || null,
    execution_id: execution_id || null,
    parent_execution_id: null,
    event_type: 'jti_used',
    service: 'bridge',
    status: 'recorded',
    payload: { jti }
  });
  processedJtis.add(jti);
  return { duplicate: false, record };
}

function resetMemoryCache() {
  processedJtis.clear();
}

warmJtiCache();

module.exports = {
  hasJti,
  recordJti,
  resetMemoryCache,
  warmJtiCache,
  get cacheSize() { return processedJtis.size; }
};
