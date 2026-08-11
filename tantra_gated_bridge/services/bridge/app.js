const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');
const replayHooks = require('../observability/replay_hooks');
const jtiStore = require('../replay_persistence/jti_store');
// FIX: Lazy-load removed — top-level import prevents deferred load errors and event-loop stall on first interval tick.
const appendOnlyStore = require('../replay_persistence/append_only_store');
require('dotenv').config();

const app = express();
// FIX: Body size limit (CWE-400 / OWASP DoS) — prevents oversized payloads from being forwarded to the execution service.
app.use(express.json({ limit: '64kb' }));
// FIX: Remove X-Powered-By to avoid fingerprinting the runtime (OWASP A05:2021 Security Misconfiguration).
app.disable('x-powered-by');

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

// FIX: SSRF mitigation (CWE-918) — validate both upstream URLs at startup, not per-request.
// Permitted schemes: https in production, http only for localhost in development.
// The process exits immediately on invalid config so the orchestrator can alert and restart cleanly.
const ALLOWED_SCHEMES = new Set(['https:']);
const ALLOWED_LOCALHOST_SCHEMES = new Set(['http:', 'https:']);
const ALLOWED_INTERNAL_HOSTS = new Set(['sarathi', 'execution']);

function validateUpstreamUrl(name, raw) {
  let parsed;

  try {
    parsed = new URL(raw);
  } catch {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      service_name: 'bridge',
      status: 'fatal',
      message: `${name} is not a valid URL: ${raw}`
    }));
    process.exit(1);
  }

  const isLocalhost =
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1';

  const isTrustedInternalHost =
    ALLOWED_INTERNAL_HOSTS.has(parsed.hostname);

  const permitted =
    isLocalhost || isTrustedInternalHost
      ? ALLOWED_LOCALHOST_SCHEMES
      : ALLOWED_SCHEMES;

  if (!permitted.has(parsed.protocol)) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      service_name: 'bridge',
      status: 'fatal',
      message: `${name} uses disallowed scheme '${parsed.protocol}' for host '${parsed.hostname}'. Permitted: ${[...permitted].join(', ')}`
    }));
    process.exit(1);
  }

  return raw;
}
const SARATHI_URL = validateUpstreamUrl('SARATHI_URL', process.env.SARATHI_URL || 'http://localhost:3001');
const EXECUTION_URL = validateUpstreamUrl('EXECUTION_URL', process.env.EXECUTION_URL || 'http://localhost:3003');

let jwksCache = null;
let jwksCacheExpiry = 0;
const JWKS_CACHE_TTL_MS = parseInt(process.env.JWKS_CACHE_TTL_MS) || 300000;

const REPLAY_TTL_MS = 3600000;

// FIX: Lazy require replaced with top-level import (appendOnlyStore, declared above).
setInterval(() => {
  const records = appendOnlyStore.getAllRecords();
  const now = Date.now();
  let expired = 0;
  for (const record of records) {
    if (record.event_type === 'jti_used' && record.payload && record.payload.jti) {
      const age = now - new Date(record.timestamp).getTime();
      if (age > REPLAY_TTL_MS) {
        expired++;
      }
    }
  }
}, 60000);

const jtiCacheSize = jtiStore.cacheSize;

async function fetchJwks() {
  const now = Date.now();
  if (jwksCache && now < jwksCacheExpiry) {
    return jwksCache;
  }
  try {
    // FIX: Timeout added (CWE-400) — a slow Sarathi response previously blocked the request indefinitely.
    const response = await axios.get(`${SARATHI_URL}/.well-known/jwks.json`, { timeout: 5000 });
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
  // FIX: Removed silent fallback to keys[0] when kid is absent (JWT key confusion risk).
  // A token without a kid header is rejected — the issuer must always specify which key was used.
  if (!kid) {
    throw new Error('JWT header missing kid claim — key identity required');
  }
  const key = keys.find(k => k.kid === kid);
  if (!key) {
    throw new Error(`Unknown kid: ${kid}`);
  }
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
  if (payload.iat && payload.iat > now + 300) throw new Error('Token issued in the future (iat)');
  if (payload.iss !== 'tantra-sarathi') throw new Error('Invalid issuer');
  if (payload.aud !== 'tantra-bridge') throw new Error('Invalid audience');
  if (!payload.jti) throw new Error('Missing jti claim');
  if (!payload.trace_id || !payload.execution_id) throw new Error('Missing trace_id or execution_id');

  return payload;
}

const validateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    log(null, null, 'bridge', 'error', 'Missing or invalid authorization header');
    replayHooks.hookRejection(null, null, 'missing_token');
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split(' ')[1];

  try {
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

    if (!decoded.jti) {
      log(decoded.trace_id, decoded.execution_id, 'bridge', 'error', 'Token missing jti claim');
      replayHooks.hookRejection(decoded.trace_id, decoded.execution_id, 'missing_jti');
      return res.status(401).json({ error: 'Unauthorized: Missing jti claim' });
    }

    if (jtiStore.hasJti(decoded.jti)) {
      // FIX: JTI truncated in log output — logging the full JTI makes the log a partial token oracle.
      log(decoded.trace_id, decoded.execution_id, 'bridge', 'error', `Replay attack detected - jti prefix: ${decoded.jti.substring(0, 8)}...`);
      replayHooks.hookRejection(decoded.trace_id, decoded.execution_id, 'replay_detected');
      return res.status(401).json({ error: 'Unauthorized: Token replay detected' });
    }

    jtiStore.recordJti({ trace_id: decoded.trace_id, execution_id: decoded.execution_id, jti: decoded.jti });

    req.tokenData = decoded;
    req.trace_id = decoded.trace_id;
    req.execution_id = decoded.execution_id;
    next();
  } catch (err) {
    log(null, null, 'bridge', 'error', `Token validation failed: ${err.message}`);
    replayHooks.hookRejection(null, null, 'token_validation_failed');
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

const enforceContinuity = (req, res, next) => {
  const tokenData = req.tokenData;

  const bodyTraceId = req.body.trace_id;
  const bodyExecutionId = req.body.execution_id;
  const bodyCetHash = req.body.cet_hash;

  const headerTraceId = req.headers['x-sarathi-trace-id'];
  const headerExecutionId = req.headers['x-sarathi-execution-id'];
  const headerCetHash = req.headers['x-sarathi-cet-hash'];

  // trace_id enforcement: body + header must match token
  if (bodyTraceId && bodyTraceId !== tokenData.trace_id) {
    log(tokenData.trace_id, tokenData.execution_id, 'bridge', 'error', 'trace_id mutation detected (body)');
    replayHooks.hookRejection(tokenData.trace_id, tokenData.execution_id, 'trace_id_mutation');
    return res.status(400).json({ error: 'trace_id mutation forbidden' });
  }
  if (headerTraceId && headerTraceId !== tokenData.trace_id) {
    log(tokenData.trace_id, tokenData.execution_id, 'bridge', 'error', 'trace_id mismatch (X-Sarathi header)');
    replayHooks.hookRejection(tokenData.trace_id, tokenData.execution_id, 'trace_id_header_mismatch');
    return res.status(400).json({ error: 'X-Sarathi-Trace-Id header mismatch' });
  }

  // execution_id enforcement: body + header must match token
  if (bodyExecutionId && bodyExecutionId !== tokenData.execution_id) {
    log(tokenData.trace_id, tokenData.execution_id, 'bridge', 'error', 'execution_id mutation detected (body)');
    replayHooks.hookRejection(tokenData.trace_id, tokenData.execution_id, 'execution_id_mutation');
    return res.status(400).json({ error: 'execution_id mutation forbidden' });
  }
  if (headerExecutionId && headerExecutionId !== tokenData.execution_id) {
    log(tokenData.trace_id, tokenData.execution_id, 'bridge', 'error', 'execution_id mismatch (X-Sarathi header)');
    replayHooks.hookRejection(tokenData.trace_id, tokenData.execution_id, 'execution_id_header_mismatch');
    return res.status(400).json({ error: 'X-Sarathi-Execution-Id header mismatch' });
  }

  // cet_hash enforcement (when present in token — required per spec)
  if (tokenData.cet_hash) {
    if (bodyCetHash === undefined || bodyCetHash !== tokenData.cet_hash) {
      log(tokenData.trace_id, tokenData.execution_id, 'bridge', 'error',
        bodyCetHash === undefined ? 'cet_hash missing in body' : 'cet_hash mismatch (body)');
      replayHooks.hookRejection(tokenData.trace_id, tokenData.execution_id, 'cet_hash_mismatch');
      return res.status(400).json({ error: 'cet_hash mismatch: body does not match token' });
    }
    if (headerCetHash === undefined || headerCetHash !== tokenData.cet_hash) {
      log(tokenData.trace_id, tokenData.execution_id, 'bridge', 'error',
        headerCetHash === undefined ? 'cet_hash missing in X-Sarathi header' : 'cet_hash mismatch (X-Sarathi header)');
      replayHooks.hookRejection(tokenData.trace_id, tokenData.execution_id, 'cet_hash_header_mismatch');
      return res.status(400).json({ error: 'X-Sarathi-Cet-Hash header mismatch' });
    }
  }

  req.trace_id = tokenData.trace_id;
  req.execution_id = tokenData.execution_id;
  next();
};

app.get('/health', (req, res) => {
  res.json({ service: 'bridge', status: 'healthy', algorithms: ['RS256', 'EdDSA'] });
});

// CSRF DESIGN DECISION: This service authenticates exclusively via Authorization: Bearer JWT headers.
// Browsers never automatically attach Authorization headers to cross-origin requests — that requires
// explicit JavaScript, which is blocked by the Same-Origin Policy. Cookie-based auth is not used
// anywhere in this service. CSRF protection middleware is therefore not applicable. (OWASP CSRF)
app.post('/execute', validateToken, enforceContinuity, async (req, res) => {
  const { trace_id, execution_id } = req;

  log(trace_id, execution_id, 'bridge', 'info', 'Request received, forwarding to execution');

  replayHooks.hookServiceTransition(trace_id, execution_id, 'bridge', 'pending', 'forwarding');

  // FIX: Input validation (CWE-20 / OWASP A03) — req.body is no longer spread blindly into the
  // downstream payload. Only the known field 'workload' is forwarded. This prevents prototype
  // pollution keys (__proto__, constructor) and unknown fields from reaching the execution service.
  const { workload } = req.body;
  if (typeof workload !== 'string' || workload.trim() === '') {
    log(trace_id, execution_id, 'bridge', 'error', 'Invalid or missing workload field in request body');
    return res.status(400).json({ error: 'Invalid request: workload must be a non-empty string' });
  }

  try {
    const response = await axios.post(
      `${EXECUTION_URL}/run`,
      {
        workload,
        trace_id,
        execution_id,
        bridge_signature: req.headers.authorization
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      }
    );

    log(trace_id, execution_id, 'bridge', 'success', 'Execution completed');
    replayHooks.hookExecutionResponse(trace_id, execution_id, 'completed', { statusCode: response.status });
    replayHooks.hookServiceTransition(trace_id, execution_id, 'bridge', 'forwarding', 'completed');
    res.status(response.status).json(response.data);
  } catch (err) {
    log(trace_id, execution_id, 'bridge', 'error', `Execution failed: ${err.message}`);
    replayHooks.hookExecutionFailure(trace_id, execution_id, err, 'execution');
    replayHooks.hookServiceTransition(trace_id, execution_id, 'bridge', 'forwarding', 'failed');

    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }

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
