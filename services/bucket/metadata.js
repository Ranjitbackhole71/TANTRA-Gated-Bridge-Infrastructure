'use strict';

// Automated metadata extraction (Phase 2, Requirement 6).
// Derives an artifact metadata record from a real Bucket storage row.
// Every value comes from the stored artifact itself or from this service;
// nothing here is fabricated.

const SERVICE_NAME = 'bucket';
const HASH_ALGORITHM = 'sha256';

function jsonTypeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

// Schema information derived from the actual stored result payload.
function deriveSchema(result) {
  const schema = { type: jsonTypeOf(result) };
  if (schema.type === 'object') {
    schema.fields = Object.keys(result).sort();
  }
  if (schema.type === 'array') {
    schema.length = result.length;
  }
  return schema;
}

// storedRow is a row from the artifacts table:
// { location, trace_id, execution_id, result, timestamp, duration_ms, stored_at, hash, created_at }
function extractArtifactMetadata(storedRow) {
  if (!storedRow || !storedRow.location || !storedRow.trace_id || !storedRow.execution_id ||
      !storedRow.hash || !storedRow.result || !storedRow.timestamp || !storedRow.stored_at) {
    throw new Error('Cannot extract metadata: incomplete artifact row');
  }

  let schema;
  try {
    schema = deriveSchema(JSON.parse(storedRow.result));
  } catch {
    schema = { type: 'unparsed' };
  }

  return {
    // The Bucket's artifact identifier is its storage location (SQLite primary key),
    // derived from the real trace_id/execution_id of the stored artifact.
    artifact_id: storedRow.location,
    trace_id: storedRow.trace_id,
    execution_id: storedRow.execution_id,
    hash: storedRow.hash,
    hash_algorithm: HASH_ALGORITHM,
    // The existing Bucket hash is sha256 over the artifact envelope fields below.
    hash_basis: 'sha256(trace_id, execution_id, result, timestamp, duration_ms, stored_at)',
    timestamp: storedRow.timestamp,
    stored_at: storedRow.stored_at,
    created_at: storedRow.created_at,
    duration_ms: storedRow.duration_ms ?? null,
    service: SERVICE_NAME,
    source: SERVICE_NAME,
    // The Bucket only accepts and stores JSON documents (express.json + JSON.stringify).
    content_type: 'application/json',
    schema
  };
}

module.exports = { extractArtifactMetadata, deriveSchema, SERVICE_NAME, HASH_ALGORITHM };
