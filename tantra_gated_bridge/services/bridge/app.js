const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');
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

const PORT = process.env.PORT || 3002;
const SARATHI_URL = process.env.SARATHI_URL || 'http://localhost:3001';
const EXECUTION_URL = process.env.EXECUTION_URL || 'http://localhost:3003';

// NO local key storage - must fetch from Sarathi
let SARATHI_PUBLIC_KEY = null;

// Replay protection: Track used jti claims
const replayCache = new Map(); // jti -> timestamp
const REPLAY_TTL_MS = 3600000; // 1 hour

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [jti, timestamp] of replayCache.entries()) {
    if (now - timestamp > REPLAY_TTL_MS) {
      replayCache.delete(jti);
    }
  }
}, 60000);

// BRIDGE RESPONSIBILITY ONLY: validate JWT, verify IDs, forward request
// FORBIDDEN: token generation, execution logic, fallback paths, mock execution

const fetchPublicKey = async () => {
  if (SARATHI_PUBLIC_KEY) return SARATHI_PUBLIC_KEY;
  try {
    const response = await axios.get(`${SARATHI_URL}/public-key`);
    SARATHI_PUBLIC_KEY = response.data.public_key;
    return SARATHI_PUBLIC_KEY;
  } catch (err) {
    // HARD FAIL: If Sarathi is down, system stops immediately
    log(null, null, 'bridge', 'error', 'Sarathi unavailable - cannot fetch public key');
    throw new Error('Sarathi authority unavailable');
  }
};

// Middleware: Validate JWT from Sarathi
const validateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    log(null, null, 'bridge', 'error', 'Missing or invalid authorization header');
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const publicKey = await fetchPublicKey();
    
    // STRICT JWT validation: issuer, expiry, signature
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: 'tantra-sarathi',
      audience: 'tantra-bridge'
    });

    // Verify token not tampered (signature check is in jwt.verify)
    // Verify trace_id and execution_id exist
    if (!decoded.trace_id || !decoded.execution_id) {
      log(null, null, 'bridge', 'error', 'Token missing trace_id or execution_id');
      return res.status(401).json({ error: 'Invalid token: missing required claims' });
    }

    // REPLAY PROTECTION: Check jti claim
    if (!decoded.jti) {
      log(decoded.trace_id, decoded.execution_id, 'bridge', 'error', 'Token missing jti claim');
      return res.status(401).json({ error: 'Unauthorized: Missing jti claim' });
    }

    // Check if token has been used before (replay attack detection)
    if (replayCache.has(decoded.jti)) {
      log(decoded.trace_id, decoded.execution_id, 'bridge', 'error', `Replay attack detected - jti: ${decoded.jti}`);
      return res.status(401).json({ error: 'Unauthorized: Token replay detected' });
    }

    // Record this jti to prevent replay
    replayCache.set(decoded.jti, Date.now());

    req.tokenData = decoded;
    next();
  } catch (err) {
    // HARD FAIL: Invalid/tampered/expired token - BLOCK immediately
    log(null, null, 'bridge', 'error', `Token validation failed: ${err.message}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// Middleware: Immutable trace_id and execution_id enforcement
const enforceImmutableIds = (req, res, next) => {
  const tokenTraceId = req.tokenData.trace_id;
  const tokenExecutionId = req.tokenData.execution_id;
  const bodyTraceId = req.body.trace_id;
  const bodyExecutionId = req.body.execution_id;

  // STRICT: IDs in body must match token - no mutation allowed
  if (bodyTraceId && bodyTraceId !== tokenTraceId) {
    log(tokenTraceId, tokenExecutionId, 'bridge', 'error', 'trace_id mutation detected');
    return res.status(400).json({ error: 'trace_id mutation forbidden' });
  }
  if (bodyExecutionId && bodyExecutionId !== tokenExecutionId) {
    log(tokenTraceId, tokenExecutionId, 'bridge', 'error', 'execution_id mutation detected');
    return res.status(400).json({ error: 'execution_id mutation forbidden' });
  }

  // Set immutable IDs
  req.trace_id = tokenTraceId;
  req.execution_id = tokenExecutionId;
  next();
};

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ service: 'bridge', status: 'healthy' });
});

// Bridge endpoint: ONLY validate and forward
app.post('/execute', validateToken, enforceImmutableIds, async (req, res) => {
  const { trace_id, execution_id } = req;
  
  log(trace_id, execution_id, 'bridge', 'info', 'Request received, forwarding to execution');

  try {
    // FORWARD request to Execution Service - Bridge does NOT execute
    const response = await axios.post(
      `${EXECUTION_URL}/run`,
      {
        ...req.body,
        trace_id,
        execution_id,
        bridge_signature: req.headers.authorization
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000 // No retries - fail fast
      }
    );

    log(trace_id, execution_id, 'bridge', 'success', 'Execution completed');
    res.status(response.status).json(response.data);
  } catch (err) {
    // HARD FAIL: If execution service down - FAIL immediately, no fallback
    log(trace_id, execution_id, 'bridge', 'error', `Execution failed: ${err.message}`);
    
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    
    // System stops - no degraded mode, no fallback execution
    return res.status(503).json({ 
      error: 'Execution service unavailable - system stopped',
      trace_id,
      execution_id
    });
  }
});

app.listen(PORT, () => {
  log(null, null, 'bridge', 'info', `Bridge Service running on port ${PORT}`);
});
