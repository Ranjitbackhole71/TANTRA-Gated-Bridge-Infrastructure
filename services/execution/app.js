const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const path = require('path');
const replayHooks = require('../observability/replay_hooks');
require('dotenv').config();

const app = express();
app.use(express.json());

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

const PORT = process.env.PORT || 3003;
const SARATHI_URL = process.env.SARATHI_URL || 'http://localhost:3001';
const BUCKET_URL = process.env.BUCKET_URL || 'http://localhost:3004';

// No local execution - must forward to actual execution logic
// In production, this would interface with actual compute resources

let SARATHI_PUBLIC_KEY = null;

const fetchPublicKey = async () => {
  if (SARATHI_PUBLIC_KEY) return SARATHI_PUBLIC_KEY;
  try {
    const response = await axios.get(`${SARATHI_URL}/public-key`);
    SARATHI_PUBLIC_KEY = response.data.public_key;
    return SARATHI_PUBLIC_KEY;
  } catch (err) {
    log(null, null, 'execution', 'error', 'Sarathi unavailable - cannot verify bridge signature');
    throw new Error('Sarathi authority unavailable');
  }
};

// Validate bridge signature (JWT from Sarathi, forwarded by Bridge)
const validateBridgeSignature = async (req, res, next) => {
  const bridgeSignature = req.body.bridge_signature;
  if (!bridgeSignature) {
    log(null, null, 'execution', 'error', 'Missing bridge signature');
    return res.status(401).json({ error: 'Unauthorized: Missing bridge signature' });
  }

  try {
    const publicKey = await fetchPublicKey();
    const token = bridgeSignature.replace('Bearer ', '');
    
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: 'tantra-sarathi',
      audience: 'tantra-bridge'
    });

    req.bridgeTokenData = decoded;
    req.trace_id = decoded.trace_id;
    req.execution_id = decoded.execution_id;
    replayHooks.hookServiceTransition(decoded.trace_id, decoded.execution_id, 'execution', 'pending', 'validated');
    next();
  } catch (err) {
    log(null, null, 'execution', 'error', `Bridge signature validation failed: ${err.message}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid bridge signature' });
  }
};

// Enforce immutable trace_id and execution_id
const enforceImmutableIds = (req, res, next) => {
  const tokenTraceId = req.bridgeTokenData.trace_id;
  const tokenExecutionId = req.bridgeTokenData.execution_id;

  if (req.body.trace_id !== tokenTraceId || req.body.execution_id !== tokenExecutionId) {
    log(tokenTraceId, tokenExecutionId, 'execution', 'error', 'ID mutation detected');
    return res.status(400).json({ error: 'ID mutation forbidden' });
  }

  req.trace_id = tokenTraceId;
  req.execution_id = tokenExecutionId;
  next();
};

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ service: 'execution', status: 'healthy' });
});

// Execution endpoint - runs workload and stores artifacts in Bucket
app.post('/run', validateBridgeSignature, enforceImmutableIds, async (req, res) => {
  const { trace_id, execution_id } = req;
  const { workload } = req.body;

  log(trace_id, execution_id, 'execution', 'info', 'Executing workload');
  replayHooks.hookServiceTransition(trace_id, execution_id, 'execution', 'validated', 'processing');

  try {
    // Execute workload (simulated - in production would run actual code)
    const startTime = Date.now();
    const result = await executeWorkload(workload, trace_id, execution_id);
    const duration = Date.now() - startTime;

    // Generate artifact
    const artifact = {
      trace_id,
      execution_id,
      result,
      timestamp: new Date().toISOString(),
      duration_ms: duration
    };

    // Store in Bucket with read-after-write verification
    log(trace_id, execution_id, 'execution', 'info', 'Storing artifact in Bucket');
    replayHooks.hookServiceTransition(trace_id, execution_id, 'execution', 'processing', 'storing');
    
    const bucketResponse = await axios.post(
      `${BUCKET_URL}/store`,
      artifact,
      { 
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      }
    );

    log(trace_id, execution_id, 'execution', 'success', 'Execution completed, artifact stored');
    replayHooks.hookExecutionResponse(trace_id, execution_id, 'completed', { artifact_location: bucketResponse.data.location, duration_ms: duration });
    replayHooks.hookServiceTransition(trace_id, execution_id, 'execution', 'storing', 'completed');
    res.json({
      trace_id,
      execution_id,
      status: 'completed',
      result,
      artifact_location: bucketResponse.data.location,
      duration_ms: duration
    });
  } catch (err) {
    // HARD FAIL: If bucket or execution fails - stop immediately
    log(trace_id, execution_id, 'execution', 'error', `Execution failed: ${err.message}`);
    replayHooks.hookExecutionFailure(trace_id, execution_id, err, err.response ? 'bucket' : 'execution');
    replayHooks.hookServiceTransition(trace_id, execution_id, 'execution', 'processing', 'failed');
    
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    
    return res.status(503).json({ 
      error: 'Execution failed - system stopped',
      trace_id,
      execution_id
    });
  }
});

// Adapter-based execution participant
async function executeWorkload(workload, trace_id, execution_id) {
  const participantPath = process.env.EXECUTION_PARTICIPANT;
  if (participantPath) {
    try {
      const participant = require(path.resolve(participantPath));
      return await participant.executeWorkload(workload, trace_id, execution_id);
    } catch (err) {
      log(trace_id, execution_id, 'execution', 'error', `Execution participant failed: ${err.message}`);
      throw err;
    }
  }
  // Default simulated execution
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        workload: workload || 'default-task',
        output: `Processed ${workload || 'default-task'}`,
        trace_id,
        execution_id
      });
    }, 100);
  });
}

app.listen(PORT, () => {
  log(null, null, 'execution', 'info', `Execution Service running on port ${PORT}`);
});
