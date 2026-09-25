const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { requestJson } = require('./runtime_helpers');
const { extractArtifactMetadata } = require('../../services/bucket/metadata');

// All artifacts created here are clearly test artifacts (trace prefix 'bucket-metadata-unit-').
// Metadata is extracted by the real Bucket service code (services/bucket/app.js + metadata.js).

async function storeTestArtifact() {
  const trace_id = `bucket-metadata-unit-${crypto.randomUUID()}`;
  const execution_id = crypto.randomUUID();
  const payload = {
    trace_id,
    execution_id,
    result: { workload: 'bucket-metadata-unit', value: 7 },
    duration_ms: 5
  };
  const stored = await requestJson('http://localhost:3004/store', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  assert.equal(stored.status, 201);
  assert.equal(stored.body.verified, true);
  return { payload, stored: stored.body };
}

function sha256Envelope({ trace_id, execution_id, result, timestamp, duration_ms, stored_at }) {
  const envelope = { trace_id, execution_id, result, timestamp, duration_ms, stored_at };
  return crypto.createHash('sha256').update(JSON.stringify(envelope)).digest('hex');
}

test('Bucket extracts metadata from a real stored artifact', async () => {
  const { stored } = await storeTestArtifact();
  assert.ok(stored.metadata, 'store response must include extracted metadata');
  assert.equal(stored.metadata.service, 'bucket');
  assert.equal(stored.metadata.source, 'bucket');
  assert.equal(stored.metadata.hash_algorithm, 'sha256');
  assert.equal(stored.metadata.content_type, 'application/json');
});

test('metadata artifact_id matches the stored artifact location', async () => {
  const { payload, stored } = await storeTestArtifact();
  assert.equal(stored.metadata.artifact_id, `artifacts/${payload.trace_id}/${payload.execution_id}`);
  assert.equal(stored.metadata.artifact_id, stored.location);
});

test('metadata trace_id and execution_id match the stored artifact', async () => {
  const { payload, stored } = await storeTestArtifact();
  assert.equal(stored.metadata.trace_id, payload.trace_id);
  assert.equal(stored.metadata.execution_id, payload.execution_id);
});

test('metadata SHA-256 is derived from the actual artifact content', async () => {
  const { stored } = await storeTestArtifact();
  const retrieved = await requestJson(`http://localhost:3004/retrieve/${stored.metadata.trace_id}/${stored.metadata.execution_id}`);
  assert.equal(retrieved.status, 200);
  const recomputed = sha256Envelope(retrieved.body);
  assert.equal(recomputed, stored.metadata.hash);
  assert.equal(retrieved.body.metadata.hash, recomputed);
  // Different content must produce a different hash (proves derivation, not fabrication).
  const other = await storeTestArtifact();
  assert.notEqual(other.stored.metadata.hash, stored.metadata.hash);
});

test('metadata timestamp, stored_at, created_at and schema are real extracted values', async () => {
  const { payload, stored } = await storeTestArtifact();
  const { metadata } = stored;
  assert.equal(typeof metadata.timestamp, 'string');
  assert.ok(Number.isFinite(Date.parse(metadata.timestamp)), 'timestamp must be ISO-8601');
  assert.ok(Number.isFinite(Date.parse(metadata.stored_at)), 'stored_at must be ISO-8601');
  // timestamp is the artifact's own real timestamp (captured at store time since the test payload omits one).
  assert.ok(Date.parse(metadata.timestamp) >= Date.parse('2020-01-01'), 'timestamp must be a real ISO date');
  assert.ok(Date.parse(metadata.timestamp) <= Date.now() + 5_000, 'timestamp must not be in the future');
  assert.ok(Date.parse(metadata.stored_at) >= Date.now() - 60_000, 'stored_at must be recent/real');
  assert.equal(typeof metadata.created_at, 'number');
  assert.ok(metadata.created_at > 0);
  // Schema derived from the real result payload.
  assert.equal(metadata.schema.type, 'object');
  assert.deepEqual(metadata.schema.fields, ['value', 'workload']);
});

test('metadata survives store -> retrieve unchanged', async () => {
  const { stored } = await storeTestArtifact();
  const retrieved = await requestJson(`http://localhost:3004/retrieve/${stored.metadata.trace_id}/${stored.metadata.execution_id}`);
  assert.equal(retrieved.status, 200);
  assert.ok(retrieved.body.metadata, 'retrieve response must include extracted metadata');
  assert.deepEqual(retrieved.body.metadata, stored.metadata);
  assert.equal(retrieved.body.metadata.hash, stored.hash);
  assert.equal(retrieved.body.metadata.artifact_id, stored.location);
});

test('metadata extraction refuses an incomplete artifact row (no fabrication)', () => {
  assert.throws(() => extractArtifactMetadata({ trace_id: 'only-trace' }), /incomplete artifact row/);
});
