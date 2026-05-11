const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

// Structured logging
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

// Replay protection: Track used jti claims with TTL
const tokenCache = new Map(); // jti -> expiry timestamp
const REPLAY_TTL_MS = 3600000; // 1 hour default (matches JWT expiry)

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [jti, expiry] of tokenCache.entries()) {
    if (expiry <= now) {
      tokenCache.delete(jti);
    }
  }
}, 60000); // Clean every minute

// Generate RSA key pair if not provided
let PRIVATE_KEY = process.env.PRIVATE_KEY;
let PUBLIC_KEY = process.env.PUBLIC_KEY;

if (!PRIVATE_KEY || !PUBLIC_KEY) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  PRIVATE_KEY = privateKey;
  PUBLIC_KEY = publicKey;
  log(null, null, 'sarathi', 'info', 'Generated new RSA key pair');
}

const ISSUER = process.env.ISSUER || 'tantra-sarathi';
const PORT = process.env.PORT || 3001;

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ service: 'sarathi', status: 'healthy', issuer: ISSUER });
});

// Token generation - ONLY place tokens are created
app.post('/token', (req, res) => {
  const { trace_id, execution_id } = req.body;
  
  // STRICT: trace_id and execution_id must be provided and immutable
  if (!trace_id || !execution_id) {
    log(trace_id, execution_id, 'sarathi', 'error', 'Missing trace_id or execution_id');
    return res.status(400).json({ error: 'trace_id and execution_id required' });
  }

  // Generate unique jti for replay protection
  const jti = crypto.randomUUID();
  const expiryMs = Date.now() + (parseInt(process.env.JWT_EXPIRY_MS) || 3600000);

  const token = jwt.sign(
    { 
      trace_id, 
      execution_id,
      iss: ISSUER,
      aud: 'tantra-bridge',
      jti,
      iat: Math.floor(Date.now() / 1000)
    },
    PRIVATE_KEY,
    { 
      algorithm: 'RS256',
      expiresIn: process.env.JWT_EXPIRY || '1h'
    }
  );

  // Store jti with expiry for replay detection
  tokenCache.set(jti, expiryMs);

  log(trace_id, execution_id, 'sarathi', 'success', `Token issued with jti: ${jti}`);
  res.json({ token, trace_id, execution_id, jti });
});

// Public key endpoint - for verification by other services
app.get('/public-key', (req, res) => {
  res.json({ public_key: PUBLIC_KEY });
});

app.listen(PORT, () => {
  log(null, null, 'sarathi', 'info', `Sarathi Authority Service running on port ${PORT}`);
});
