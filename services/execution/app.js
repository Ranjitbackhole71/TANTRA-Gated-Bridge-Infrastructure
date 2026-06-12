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

let jwksCache = null;
let jwksCacheExpiry = 0;
const JWKS_CACHE_TTL_MS = 300000;

async function fetchJwks() {
  const now = Date.now();
  if (jwksCache && now < jwksCacheExpiry) {
    return jwksCache;
  }
  try {
    const response = await axios.get(`${SARATHI_URL}/.well-known/jwks.json`);
    if (!response.data.keys || response.data.keys.length === 0) {
      throw new Error('Empty JWKS keyset');
    }
    jwksCache = response.data.keys;
    jwksCacheExpiry = now + JWKS_CACHE_TTL_MS;
    return jwksCache;
  } catch (err) {
    if (jwksCache) {
      log(null, null, 'execution', 'warn', 'JWKS fetch failed, using stale cache');
      return jwksCache;
    }
    log(null, null, 'execution', 'error', 'Sarathi unavailable - cannot fetch JWKS');
    throw new Error('Sarathi authority unavailable');
  }
}

function resolveJwk(keys, kid) {
  if (!kid) return keys[0];
  const key = keys.find(k => k.kid === kid);
  if (!key) throw new Error(`Unknown kid: ${kid}`);
  return key;
}

function jwkToKeyObject(jwk) {
  return crypto.createPublicKey({ format: 'jwk', key: jwk });
}

function verifyEdDSAToken(token, jwk) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');

  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  const signature = Buffer.from(parts[2], 'base64url');

  const keyObject = jwkToKeyObject(jwk);
  const isValid = crypto.verify(null, Buffer.from(parts[0] + '.' + parts[1]), keyObject, signature);
  if (!isValid) throw new Error('Invalid EdDSA signature');

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error('Token expired');
  if (payload.iss !== 'tantra-sarathi') throw new Error('Invalid issuer');
  if (payload.aud !== 'tantra-bridge') throw new Error('Invalid audience');
  if (!payload.jti) throw new Error('Missing jti claim');
  if (!payload.trace_id || !payload.execution_id) throw new Error('Missing trace_id or execution_id');

  return payload;
}

const validateBridgeSignature = async (req, res, next) => {
  const bridgeSignature = req.body.bridge_signature;
  if (!bridgeSignature) {
    log(null, null, 'execution', 'error', 'Missing bridge signature');
    return res.status(401).json({ error: 'Unauthorized: Missing bridge signature' });
  }

  try {
    const token = bridgeSignature.replace('Bearer ', '');

    const decodedHeader = jwt.decode(token, { complete: true });
    if (!decodedHeader || !decodedHeader.header) {
      throw new Error('Failed to decode JWT header');
    }
    const kid = decodedHeader.header.kid;
    const alg = decodedHeader.header.alg;

    const keys = await fetchJwks();
    const jwk = resolveJwk(keys, kid);

    let decoded;

    if (alg === 'EdDSA') {
      decoded = verifyEdDSAToken(token, jwk);
    } else if (alg === 'RS256') {
      const pem = jwkToKeyObject(jwk).export({ format: 'pem', type: 'spki' });
      decoded = jwt.verify(token, pem, {
        algorithms: ['RS256'],
        issuer: 'tantra-sarathi',
        audience: 'tantra-bridge'
      });
    } else {
      throw new Error(`Unsupported algorithm: ${alg}`);
    }

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

app.get('/health', (req, res) => {
  res.json({ service: 'execution', status: 'healthy', algorithms: ['RS256', 'EdDSA'] });
});

app.post('/run', validateBridgeSignature, enforceImmutableIds, async (req, res) => {
  const { trace_id, execution_id } = req;
  const { workload } = req.body;

  log(trace_id, execution_id, 'execution', 'info', 'Executing workload');
  replayHooks.hookServiceTransition(trace_id, execution_id, 'execution', 'validated', 'processing');

  try {
    const startTime = Date.now();
    const result = await executeWorkload(workload, trace_id, execution_id);
    const duration = Date.now() - startTime;

    const artifact = {
      trace_id,
      execution_id,
      result,
      timestamp: new Date().toISOString(),
      duration_ms: duration
    };

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
