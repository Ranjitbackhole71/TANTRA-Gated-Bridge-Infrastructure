const express = require('express');
const crypto = require('crypto');
const Database = require('better-sqlite3');
require('dotenv').config();

const app = express();
app.use(express.json());

// SQLite-backed persistent storage
const db = new Database('bucket.db');

// Create artifacts table with schema validation
db.exec(`
  CREATE TABLE IF NOT EXISTS artifacts (
    location TEXT PRIMARY KEY,
    trace_id TEXT NOT NULL,
    execution_id TEXT NOT NULL,
    result TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    duration_ms INTEGER,
    stored_at TEXT NOT NULL,
    hash TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  )
`);

const log = (trace_id, execution_id, service_name, status, message) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    trace_id,
    execution_id,
    service_name,
    status,
    message
  }));
};

const PORT = process.env.PORT || 3004;

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ service: 'bucket', status: 'healthy' });
});

// Store artifact with read-after-write verification
app.post('/store', async (req, res) => {
  const { trace_id, execution_id, result, timestamp, duration_ms } = req.body;

  if (!trace_id || !execution_id) {
    log(trace_id, execution_id, 'bucket', 'error', 'Missing trace_id or execution_id');
    return res.status(400).json({ error: 'trace_id and execution_id required' });
  }

  // Schema validation
  if (!result) {
    log(trace_id, execution_id, 'bucket', 'error', 'Schema validation failed: missing result');
    return res.status(400).json({ error: 'Schema validation failed: result required' });
  }

  log(trace_id, execution_id, 'bucket', 'info', 'Storing artifact');

  try {
    // Create artifact object
    const stored_at = new Date().toISOString();
    const artifact = {
      trace_id,
      execution_id,
      result,
      timestamp,
      duration_ms,
      stored_at
    };

    // Generate hash for verification
    const artifactHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(artifact))
      .digest('hex');

    // Store location
    const location = `artifacts/${trace_id}/${execution_id}`;

    // SQLite: Insert with hash
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO artifacts (location, trace_id, execution_id, result, timestamp, duration_ms, stored_at, hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      location,
      trace_id,
      execution_id,
      JSON.stringify(result),
      timestamp,
      duration_ms,
      stored_at,
      artifactHash
    );

    log(trace_id, execution_id, 'bucket', 'info', 'Artifact stored, verifying with read-after-write');

    // MANDATORY: Read-after-write verification (persists after restart)
    const stored = db.prepare('SELECT * FROM artifacts WHERE location = ?').get(location);
    
    if (!stored) {
      log(trace_id, execution_id, 'bucket', 'error', 'Read-after-write failed: artifact not found');
      // Rollback
      db.prepare('DELETE FROM artifacts WHERE location = ?').run(location);
      return res.status(500).json({ 
        error: 'Storage verification failed: artifact not found',
        trace_id,
        execution_id
      });
    }

    // Verify hash matches
    if (stored.hash !== artifactHash) {
      log(trace_id, execution_id, 'bucket', 'error', 'Read-after-write failed: hash mismatch');
      db.prepare('DELETE FROM artifacts WHERE location = ?').run(location);
      return res.status(500).json({ 
        error: 'Storage verification failed: hash mismatch',
        trace_id,
        execution_id
      });
    }

    // Verify schema validity (double-check)
    if (!stored.trace_id || !stored.execution_id || !stored.result) {
      log(trace_id, execution_id, 'bucket', 'error', 'Schema validation failed');
      db.prepare('DELETE FROM artifacts WHERE location = ?').run(location);
      return res.status(500).json({ 
        error: 'Storage verification failed: invalid schema',
        trace_id,
        execution_id
      });
    }

    log(trace_id, execution_id, 'bucket', 'success', 'Artifact stored and verified (persistent)');
    res.status(201).json({
      location,
      trace_id,
      execution_id,
      hash: artifactHash,
      verified: true,
      persistent: true
    });
  } catch (err) {
    log(trace_id, execution_id, 'bucket', 'error', `Storage failed: ${err.message}`);
    return res.status(500).json({ 
      error: 'Bucket storage failed - system stopped',
      trace_id,
      execution_id
    });
  }
});

// Retrieve artifact
app.get('/retrieve/:trace_id/:execution_id', (req, res) => {
  const { trace_id, execution_id } = req.params;
  const location = `artifacts/${trace_id}/${execution_id}`;
  
  const stored = db.prepare('SELECT * FROM artifacts WHERE location = ?').get(location);
  
  if (!stored) {
    log(trace_id, execution_id, 'bucket', 'error', 'Artifact not found');
    return res.status(404).json({ error: 'Artifact not found' });
  }

  // Parse result back from JSON
  const artifact = {
    trace_id: stored.trace_id,
    execution_id: stored.execution_id,
    result: JSON.parse(stored.result),
    timestamp: stored.timestamp,
    duration_ms: stored.duration_ms,
    stored_at: stored.stored_at,
    hash: stored.hash
  };

  log(trace_id, execution_id, 'bucket', 'success', 'Artifact retrieved (persistent)');
  res.json(artifact);
});

app.listen(PORT, () => {
  log(null, null, 'bucket', 'info', `Bucket Service running on port ${PORT}`);
});
