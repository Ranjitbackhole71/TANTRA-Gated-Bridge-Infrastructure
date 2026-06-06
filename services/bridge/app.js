const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');
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

const PORT = process.env.PORT || 3002;
const SARATHI_URL = process.env.SARATHI_URL || 'http://localhost:3001';
const EXECUTION_URL = process.env.EXECUTION_URL || 'http://localhost:3003';

// NO local key storage - must fetch from Sarathi via JWKS
let jwksCache = null;
let jwksCacheExpiry = 0;
const JWKS_CACHE_TTL_MS = parseInt(process.env.JWKS_CACHE_TTL_MS) || 300000; // 5 min default

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

async function fetchJwks() {
  const now = Date.now();
  if (jwksCache && now < jwksCacheExpiry) {
    return jwksCache;
  }
  try {
    const response = await axios.get(`${SARATHI_URL}/jwks`);
    if (!response.data.keys || response.data.keys.length === 0) {
      throw new Error('Empty JWKS keyset');
    }
    jwksCache = response.data.keys;
    jwksCacheExpiry = now + JWKS_CACHE_TTL_MS;
    log(null, null, 'bridge', 'info', `JWKS fetched (${jwksCache.length} keys, cache TTL ${JWKS_CACHE_TTL_MS}ms)`);
    return jwksCache;
  } catch (err) {
    if (jwksCache) {
      log(null, null, 'bridge', 'warn', 'JWKS fetch failed, using stale cache');
      return jwksCache;
    }
    log(null, null, 'bridge', 'error', 'Sarathi unavailable - cannot fetch JWKS');
    throw new Error('Sarathi authority unavailable');
  }
}

function resolveJwk(keys, kid) {
  if (!kid) {
    return keys[0];
  }
  const key = keys.find(k => k.kid === kid);
  if (!key) {
    throw new Error(`Unknown kid: ${kid}`);
  }
  return key;
}

function jwkToPem(jwk) {
  const keyObj = crypto.createPublicKey({ format: 'jwk', key: jwk });
  return keyObj.export({ format: 'pem', type: 'spki' });
}

// Middleware: Validate JWT from Sarathi via JWKS
const validateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    log(null, null, 'bridge', 'error', 'Missing or invalid authorization header');
    replayHooks.hookRejection(null, null, 'missing_token');
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    // Decode header to extract kid for key resolution
    const decodedHeader = jwt.decode(token, { complete: true });
    if (!decodedHeader || !decodedHeader.header) {
      throw new Error('Failed to decode JWT header');
    }
    const kid = decodedHeader.header.kid;

    // Fetch JWKS and resolve key by kid
    const keys = await fetchJwks();
    const jwk = resolveJwk(keys, kid);
    const publicKey = jwkToPem(jwk);
    
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
      replayHooks.hookRejection(decoded.trace_id, decoded.execution_id, 'missing_claims');
      return res.status(401).json({ error: 'Invalid token: missing required claims' });
    }

    // REPLAY PROTECTION: Check jti claim
    if (!decoded.jti) {
      log(decoded.trace_id, decoded.execution_id, 'bridge', 'error', 'Token missing jti claim');
      replayHooks.hookRejection(decoded.trace_id, decoded.execution_id, 'missing_jti');
      return res.status(401).json({ error: 'Unauthorized: Missing jti claim' });
    }

    // Check if token has been used before (replay attack detection)
    if (replayCache.has(decoded.jti)) {
      log(decoded.trace_id, decoded.execution_id, 'bridge', 'error', `Replay attack detected - jti: ${decoded.jti}`);
      replayHooks.hookRejection(decoded.trace_id, decoded.execution_id, 'replay_detected');
      return res.status(401).json({ error: 'Unauthorized: Token replay detected' });
    }

    // Record this jti to prevent replay
    replayCache.set(decoded.jti, Date.now());

    req.tokenData = decoded;
    req.trace_id = decoded.trace_id;
    req.execution_id = decoded.execution_id;
    next();
  } catch (err) {
    // HARD FAIL: Invalid/tampered/expired token - BLOCK immediately
    log(null, null, 'bridge', 'error', `Token validation failed: ${err.message}`);
    replayHooks.hookRejection(null, null, 'token_validation_failed');
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
    replayHooks.hookRejection(tokenTraceId, tokenExecutionId, 'trace_id_mutation');
    return res.status(400).json({ error: 'trace_id mutation forbidden' });
  }
  if (bodyExecutionId && bodyExecutionId !== tokenExecutionId) {
    log(tokenTraceId, tokenExecutionId, 'bridge', 'error', 'execution_id mutation detected');
    replayHooks.hookRejection(tokenTraceId, tokenExecutionId, 'execution_id_mutation');
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

  replayHooks.hookServiceTransition(trace_id, execution_id, 'bridge', 'pending', 'forwarding');

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
    replayHooks.hookExecutionResponse(trace_id, execution_id, 'completed', { statusCode: response.status });
    replayHooks.hookServiceTransition(trace_id, execution_id, 'bridge', 'forwarding', 'completed');
    res.status(response.status).json(response.data);
  } catch (err) {
    // HARD FAIL: If execution service down - FAIL immediately, no fallback
    log(trace_id, execution_id, 'bridge', 'error', `Execution failed: ${err.message}`);
    replayHooks.hookExecutionFailure(trace_id, execution_id, err, 'execution');
    replayHooks.hookServiceTransition(trace_id, execution_id, 'bridge', 'forwarding', 'failed');
    
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
