const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const RESULTS = [];
let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function logResult(name, status, detail) {
  const entry = { test: name, status, detail: detail || '' };
  RESULTS.push(entry);
  if (status === 'PASS') passed++;
  else failed++;
  console.log(`  ${status}: ${name}${detail ? ' — ' + detail : ''}`);
}

// =====================================================
// TEST INFRASTRUCTURE
// =====================================================

function base64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

// Generate Ed25519 key pair for tests
const ed25519KeyPair = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

// Generate RSA key pair for backward compatibility tests
const rsaKeyPair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

// Create EdDSA JWK from public key
function ed25519PublicKeyToJwk() {
  const keyObj = crypto.createPublicKey(ed25519KeyPair.publicKey);
  const jwk = keyObj.export({ format: 'jwk' });
  jwk.kid = 'test-ed25519-kid';
  jwk.alg = 'EdDSA';
  jwk.use = 'sig';
  return jwk;
}

// Create RSA JWK from public key
function rsaPublicKeyToJwk() {
  const keyObj = crypto.createPublicKey(rsaKeyPair.publicKey);
  const jwk = keyObj.export({ format: 'jwk' });
  jwk.kid = 'test-rsa-kid';
  jwk.alg = 'RS256';
  jwk.use = 'sig';
  return jwk;
}

const ED25519_JWK = ed25519PublicKeyToJwk();
const RSA_JWK = rsaPublicKeyToJwk();
const JWKS = { keys: [ED25519_JWK, RSA_JWK] };

// Sign an EdDSA JWT manually (same as Sarathi does)
function signEdDSAToken(claims, kid) {
  const header = { alg: 'EdDSA', kid, typ: 'JWT' };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(claims));
  const signingInput = headerB64 + '.' + payloadB64;
  const privateKey = crypto.createPrivateKey(ed25519KeyPair.privateKey);
  const signature = crypto.sign(null, Buffer.from(signingInput), privateKey);
  return signingInput + '.' + base64url(signature);
}

// Sign an RS256 JWT using jsonwebtoken
function signRS256Token(claims, kid) {
  return jwt.sign(claims, rsaKeyPair.privateKey, {
    algorithm: 'RS256',
    keyid: kid,
    expiresIn: '1h'
  });
}

// Bridge's verifyEdDSAToken function (pulled from bridge/app.js)
function verifyEdDSAToken(token, jwk) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');

  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  const signature = Buffer.from(parts[2], 'base64url');

  const keyObject = crypto.createPublicKey({ format: 'jwk', key: jwk });
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

// Bridge's resolveJwk function (pulled from bridge/app.js)
function resolveJwk(keys, kid) {
  if (!kid) return keys[0];
  const key = keys.find(k => k.kid === kid);
  if (!key) throw new Error(`Unknown kid: ${kid}`);
  return key;
}

// Bridge's enforceContinuity logic (pulled from bridge/app.js)
function enforceContinuity(tokenData, body, headers) {
  const bodyTraceId = body.trace_id;
  const bodyExecutionId = body.execution_id;
  const bodyCetHash = body.cet_hash;

  const headerTraceId = headers['x-sarathi-trace-id'];
  const headerExecutionId = headers['x-sarathi-execution-id'];
  const headerCetHash = headers['x-sarathi-cet-hash'];

  if (bodyTraceId && bodyTraceId !== tokenData.trace_id) {
    throw new Error('trace_id mutation detected (body)');
  }
  if (headerTraceId && headerTraceId !== tokenData.trace_id) {
    throw new Error('trace_id mismatch (X-Sarathi header)');
  }
  if (bodyExecutionId && bodyExecutionId !== tokenData.execution_id) {
    throw new Error('execution_id mutation detected (body)');
  }
  if (headerExecutionId && headerExecutionId !== tokenData.execution_id) {
    throw new Error('execution_id mismatch (X-Sarathi header)');
  }
  if (tokenData.cet_hash) {
    if (bodyCetHash === undefined || bodyCetHash !== tokenData.cet_hash) {
      throw new Error('cet_hash mismatch (body)');
    }
    if (headerCetHash === undefined || headerCetHash !== tokenData.cet_hash) {
      throw new Error('cet_hash mismatch (X-Sarathi header)');
    }
  }
}

// =====================================================
// TEST 1: VALID EdDSA token → ACCEPT
// =====================================================
function testValidEdDSAToken() {
  const trace_id = crypto.randomUUID();
  const execution_id = crypto.randomUUID();
  const cet_hash = crypto.createHash('sha256').update(trace_id + ':' + execution_id).digest('hex');
  const jti = crypto.randomUUID();

  const claims = {
    trace_id, execution_id, cet_hash,
    iss: 'tantra-sarathi',
    aud: 'tantra-bridge',
    jti,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  };

  const token = signEdDSAToken(claims, ED25519_JWK.kid);

  // Resolve JWK by kid
  const jwk = resolveJwk(JWKS.keys, ED25519_JWK.kid);

  // Verify token
  const decoded = verifyEdDSAToken(token, jwk);

  // Verify claims
  assert(decoded.trace_id === trace_id, 'trace_id should match');
  assert(decoded.execution_id === execution_id, 'execution_id should match');
  assert(decoded.cet_hash === cet_hash, 'cet_hash should match');
  assert(decoded.iss === 'tantra-sarathi', 'issuer should match');

  // Enforce continuity
  enforceContinuity(decoded,
    { trace_id, execution_id, cet_hash },
    {
      'x-sarathi-trace-id': trace_id,
      'x-sarathi-execution-id': execution_id,
      'x-sarathi-cet-hash': cet_hash
    }
  );

  logResult('TEST-01: Valid EdDSA token', 'PASS', 'token issued, verified, continuity enforced');
}

// =====================================================
// TEST 2: VALID RS256 token (backward compatibility) → ACCEPT
// =====================================================
function testValidRS256Token() {
  const trace_id = crypto.randomUUID();
  const execution_id = crypto.randomUUID();
  const cet_hash = crypto.createHash('sha256').update(trace_id + ':' + execution_id).digest('hex');

  const claims = {
    trace_id, execution_id, cet_hash,
    iss: 'tantra-sarathi',
    aud: 'tantra-bridge',
    jti: crypto.randomUUID(),
    iat: Math.floor(Date.now() / 1000)
  };

  const token = signRS256Token(claims, RSA_JWK.kid);

  const decoded = jwt.verify(token, rsaKeyPair.publicKey, {
    algorithms: ['RS256'],
    issuer: 'tantra-sarathi',
    audience: 'tantra-bridge'
  });

  assert(decoded.trace_id === trace_id, 'trace_id should match');
  assert(decoded.execution_id === execution_id, 'execution_id should match');
  assert(decoded.cet_hash === cet_hash, 'cet_hash should match');

  logResult('TEST-02: Valid RS256 token (backward compat)', 'PASS', 'RS256 token verified successfully');
}

// =====================================================
// TEST 3: INVALID execution_id (body mismatch) → REJECT
// =====================================================
function testInvalidExecutionIdBody() {
  const trace_id = crypto.randomUUID();
  const origExecutionId = crypto.randomUUID();
  const cet_hash = crypto.createHash('sha256').update(trace_id + ':' + origExecutionId).digest('hex');

  const claims = {
    trace_id, execution_id: origExecutionId, cet_hash,
    iss: 'tantra-sarathi',
    aud: 'tantra-bridge',
    jti: crypto.randomUUID(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  };

  const token = signEdDSAToken(claims, ED25519_JWK.kid);
  const decoded = verifyEdDSAToken(token, resolveJwk(JWKS.keys, ED25519_JWK.kid));

  let rejected = false;
  try {
    enforceContinuity(decoded,
      { trace_id, execution_id: 'different-exec-id', cet_hash },
      {
        'x-sarathi-trace-id': trace_id,
        'x-sarathi-execution-id': origExecutionId,
        'x-sarathi-cet-hash': cet_hash
      }
    );
  } catch (e) {
    rejected = e.message.includes('execution_id mutation');
  }

  assert(rejected, 'Should reject mutated execution_id in body');
  logResult('TEST-03: INVALID execution_id (body)', 'PASS', 'correctly rejected mutated execution_id');
}

// =====================================================
// TEST 4: INVALID trace_id (X-Sarathi header mismatch) → REJECT
// =====================================================
function testInvalidTraceIdHeader() {
  const trace_id = crypto.randomUUID();
  const execution_id = crypto.randomUUID();
  const cet_hash = crypto.createHash('sha256').update(trace_id + ':' + execution_id).digest('hex');

  const claims = {
    trace_id, execution_id, cet_hash,
    iss: 'tantra-sarathi',
    aud: 'tantra-bridge',
    jti: crypto.randomUUID(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  };

  const token = signEdDSAToken(claims, ED25519_JWK.kid);
  const decoded = verifyEdDSAToken(token, resolveJwk(JWKS.keys, ED25519_JWK.kid));

  let rejected = false;
  try {
    enforceContinuity(decoded,
      { trace_id, execution_id, cet_hash },
      {
        'x-sarathi-trace-id': 'different-trace-id',
        'x-sarathi-execution-id': execution_id,
        'x-sarathi-cet-hash': cet_hash
      }
    );
  } catch (e) {
    rejected = e.message.includes('trace_id mismatch');
  }

  assert(rejected, 'Should reject mismatched trace_id in header');
  logResult('TEST-04: INVALID trace_id (header)', 'PASS', 'correctly rejected mismatched X-Sarathi-Trace-Id');
}

// =====================================================
// TEST 5: INVALID cet_hash (body mismatch) → REJECT
// =====================================================
function testInvalidCetHashBody() {
  const trace_id = crypto.randomUUID();
  const execution_id = crypto.randomUUID();
  const cet_hash = crypto.createHash('sha256').update(trace_id + ':' + execution_id).digest('hex');

  const claims = {
    trace_id, execution_id, cet_hash,
    iss: 'tantra-sarathi',
    aud: 'tantra-bridge',
    jti: crypto.randomUUID(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  };

  const token = signEdDSAToken(claims, ED25519_JWK.kid);
  const decoded = verifyEdDSAToken(token, resolveJwk(JWKS.keys, ED25519_JWK.kid));

  let rejected = false;
  try {
    enforceContinuity(decoded,
      { trace_id, execution_id, cet_hash: 'wrong-cet-hash' },
      {
        'x-sarathi-trace-id': trace_id,
        'x-sarathi-execution-id': execution_id,
        'x-sarathi-cet-hash': cet_hash
      }
    );
  } catch (e) {
    rejected = e.message.includes('cet_hash mismatch (body)');
  }

  assert(rejected, 'Should reject mismatched cet_hash in body');
  logResult('TEST-05: INVALID cet_hash (body)', 'PASS', 'correctly rejected mismatched cet_hash');
}

// =====================================================
// TEST 6: INVALID cet_hash (X-Sarathi header mismatch) → REJECT
// =====================================================
function testInvalidCetHashHeader() {
  const trace_id = crypto.randomUUID();
  const execution_id = crypto.randomUUID();
  const cet_hash = crypto.createHash('sha256').update(trace_id + ':' + execution_id).digest('hex');

  const claims = {
    trace_id, execution_id, cet_hash,
    iss: 'tantra-sarathi',
    aud: 'tantra-bridge',
    jti: crypto.randomUUID(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  };

  const token = signEdDSAToken(claims, ED25519_JWK.kid);
  const decoded = verifyEdDSAToken(token, resolveJwk(JWKS.keys, ED25519_JWK.kid));

  let rejected = false;
  try {
    enforceContinuity(decoded,
      { trace_id, execution_id, cet_hash },
      {
        'x-sarathi-trace-id': trace_id,
        'x-sarathi-execution-id': execution_id,
        'x-sarathi-cet-hash': 'wrong-cet-hash-header'
      }
    );
  } catch (e) {
    rejected = e.message.includes('cet_hash mismatch (X-Sarathi header)');
  }

  assert(rejected, 'Should reject mismatched cet_hash in header');
  logResult('TEST-06: INVALID cet_hash (header)', 'PASS', 'correctly rejected mismatched X-Sarathi-Cet-Hash');
}

// =====================================================
// TEST 7: UNKNOWN kid → REJECT
// =====================================================
function testUnknownKid() {
  const trace_id = crypto.randomUUID();
  const execution_id = crypto.randomUUID();

  const claims = {
    trace_id, execution_id,
    iss: 'tantra-sarathi',
    aud: 'tantra-bridge',
    jti: crypto.randomUUID(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  };

  const token = signEdDSAToken(claims, 'non-existent-kid');

  let rejected = false;
  try {
    resolveJwk(JWKS.keys, 'non-existent-kid');
  } catch (e) {
    rejected = e.message.includes('Unknown kid');
  }

  assert(rejected, 'Should reject unknown kid');
  logResult('TEST-07: UNKNOWN kid', 'PASS', 'correctly rejected token with unknown kid');
}

// =====================================================
// TEST 8: INVALID SIGNATURE (tampered token) → REJECT
// =====================================================
function testInvalidSignature() {
  const trace_id = crypto.randomUUID();
  const execution_id = crypto.randomUUID();

  const claims = {
    trace_id, execution_id,
    iss: 'tantra-sarathi',
    aud: 'tantra-bridge',
    jti: crypto.randomUUID(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  };

  const token = signEdDSAToken(claims, ED25519_JWK.kid);

  // Tamper with the payload
  const parts = token.split('.');
  const tamperedPayload = base64url(JSON.stringify({ ...claims, trace_id: 'tampered' }));
  const tamperedToken = parts[0] + '.' + tamperedPayload + '.' + parts[2];

  let rejected = false;
  try {
    verifyEdDSAToken(tamperedToken, resolveJwk(JWKS.keys, ED25519_JWK.kid));
  } catch (e) {
    rejected = e.message.includes('Invalid EdDSA signature') || e.message.includes('Invalid signature');
  }

  assert(rejected, 'Should reject tampered token');
  logResult('TEST-08: INVALID SIGNATURE (tampered)', 'PASS', 'correctly rejected tampered token');
}

// =====================================================
// TEST 9: JWKS kid resolution
// =====================================================
function testJwksKidResolution() {
  const resolvedEd25519 = resolveJwk(JWKS.keys, ED25519_JWK.kid);
  assert(resolvedEd25519.kid === ED25519_JWK.kid, 'Should resolve Ed25519 JWK by kid');
  assert(resolvedEd25519.kty === 'OKP', 'Ed25519 JWK should have kty=OKP');
  assert(resolvedEd25519.crv === 'Ed25519', 'Ed25519 JWK should have crv=Ed25519');
  assert(resolvedEd25519.alg === 'EdDSA', 'Ed25519 JWK should have alg=EdDSA');

  const resolvedRsa = resolveJwk(JWKS.keys, RSA_JWK.kid);
  assert(resolvedRsa.kid === RSA_JWK.kid, 'Should resolve RSA JWK by kid');
  assert(resolvedRsa.kty === 'RSA', 'RSA JWK should have kty=RSA');
  assert(resolvedRsa.alg === 'RS256', 'RSA JWK should have alg=RS256');

  const noKid = resolveJwk(JWKS.keys, null);
  assert(noKid !== undefined, 'Should return first key if no kid');

  logResult('TEST-09: JWKS kid resolution', 'PASS', 'kid resolution works for OKP/Ed25519 and RSA');
}

// =====================================================
// TEST 10: cet_hash missing in body → REJECT
// =====================================================
function testMissingCetHashBody() {
  const trace_id = crypto.randomUUID();
  const execution_id = crypto.randomUUID();
  const cet_hash = crypto.createHash('sha256').update(trace_id + ':' + execution_id).digest('hex');

  const claims = {
    trace_id, execution_id, cet_hash,
    iss: 'tantra-sarathi',
    aud: 'tantra-bridge',
    jti: crypto.randomUUID(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  };

  const token = signEdDSAToken(claims, ED25519_JWK.kid);
  const decoded = verifyEdDSAToken(token, resolveJwk(JWKS.keys, ED25519_JWK.kid));

  let rejected = false;
  try {
    // Body missing cet_hash entirely (undefined)
    enforceContinuity(decoded,
      { trace_id, execution_id },
      {
        'x-sarathi-trace-id': trace_id,
        'x-sarathi-execution-id': execution_id,
        'x-sarathi-cet-hash': cet_hash
      }
    );
  } catch (e) {
    rejected = e.message.includes('cet_hash mismatch (body)');
  }

  assert(rejected, 'Should reject missing cet_hash in body when token has cet_hash');
  logResult('TEST-10: Missing cet_hash in body', 'PASS', 'correctly rejected missing cet_hash in body');
}

// =====================================================
// TEST 11: EdDSA token with OKP JWK format
// =====================================================
function testOkpJwkFormat() {
  const jwk = ED25519_JWK;
  assert(jwk.kty === 'OKP', 'Ed25519 JWK must have kty=OKP');
  assert(jwk.crv === 'Ed25519', 'Ed25519 JWK must have crv=Ed25519');
  assert(jwk.x !== undefined, 'Ed25519 JWK must have x (public key)');
  assert(jwk.d === undefined, 'Ed25519 JWK must NOT have d (private key) in public JWK');

  // Verify we can create a public key from the OKP JWK
  const keyObj = crypto.createPublicKey({ format: 'jwk', key: jwk });
  const exported = keyObj.export({ format: 'pem', type: 'spki' });
  assert(exported.includes('PUBLIC KEY'), 'Should export as PEM public key');

  logResult('TEST-11: OKP/Ed25519 JWK format', 'PASS', 'OKP JWK format is correct and crypto-compatible');
}

// =====================================================
// TEST 12: Token expiry enforcement
// =====================================================
function testExpiredToken() {
  const trace_id = crypto.randomUUID();
  const execution_id = crypto.randomUUID();

  const claims = {
    trace_id, execution_id,
    iss: 'tantra-sarathi',
    aud: 'tantra-bridge',
    jti: crypto.randomUUID(),
    iat: Math.floor(Date.now() / 1000) - 7200,
    exp: Math.floor(Date.now() / 1000) - 3600  // expired 1 hour ago
  };

  const token = signEdDSAToken(claims, ED25519_JWK.kid);

  let rejected = false;
  try {
    verifyEdDSAToken(token, resolveJwk(JWKS.keys, ED25519_JWK.kid));
  } catch (e) {
    rejected = e.message.includes('expired');
  }

  assert(rejected, 'Should reject expired token');
  logResult('TEST-12: Expired token rejection', 'PASS', 'correctly rejected expired EdDSA token');
}

// =====================================================
// =====================================================
// RUN ALL TESTS
// =====================================================
// =====================================================

const testFunctions = [
  { name: 'TEST-01', fn: testValidEdDSAToken },
  { name: 'TEST-02', fn: testValidRS256Token },
  { name: 'TEST-03', fn: testInvalidExecutionIdBody },
  { name: 'TEST-04', fn: testInvalidTraceIdHeader },
  { name: 'TEST-05', fn: testInvalidCetHashBody },
  { name: 'TEST-06', fn: testInvalidCetHashHeader },
  { name: 'TEST-07', fn: testUnknownKid },
  { name: 'TEST-08', fn: testInvalidSignature },
  { name: 'TEST-09', fn: testJwksKidResolution },
  { name: 'TEST-10', fn: testMissingCetHashBody },
  { name: 'TEST-11', fn: testOkpJwkFormat },
  { name: 'TEST-12', fn: testExpiredToken }
];

async function runAll() {
  console.log('\n========================================');
  console.log('  TANTRA CONVERGENCE TEST SUITE');
  console.log('========================================\n');

  for (const t of testFunctions) {
    try {
      await t.fn();
    } catch (err) {
      logResult(t.name, 'FAIL', err.message);
    }
  }

  console.log('\n========================================');
  console.log('  RESULTS');
  console.log('========================================');
  console.log(`  Total: ${passed + failed}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log('========================================\n');

  for (const r of RESULTS) {
    console.log(`  [${r.status}] ${r.test}${r.detail ? ': ' + r.detail : ''}`);
  }

  console.log('\n' + (failed === 0 ? '  ALL TESTS PASSED' : `  ${failed} TEST(S) FAILED`));
  console.log('========================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

if (require.main === module) {
  runAll().catch(err => {
    console.error('Test suite error:', err);
    process.exit(1);
  });
}

module.exports = {
  testValidEdDSAToken,
  testValidRS256Token,
  testInvalidExecutionIdBody,
  testInvalidTraceIdHeader,
  testInvalidCetHashBody,
  testInvalidCetHashHeader,
  testUnknownKid,
  testInvalidSignature,
  testJwksKidResolution,
  testMissingCetHashBody,
  testOkpJwkFormat,
  testExpiredToken,
  runAll
};
