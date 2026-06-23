const crypto = require('crypto');
const http = require('http');

// Replicate exactly what the bridge does
const SARATHI_URL = 'http://localhost:3001';

async function fetchJwks() {
  return new Promise((resolve, reject) => {
    http.get(SARATHI_URL + '/.well-known/jwks.json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data).keys); }
        catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function resolveJwk(keys, kid) {
  if (!kid) return keys[0];
  const key = keys.find(k => k.kid === kid);
  if (!key) throw new Error('Unknown kid: ' + kid);
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

  console.log('Key type:', keyObject.asymmetricKeyType);
  console.log('Payload claims:', JSON.stringify({
    iss: payload.iss, aud: payload.aud,
    has_jti: !!payload.jti,
    has_trace: !!payload.trace_id,
    has_exec: !!payload.execution_id,
    exp: payload.exp,
    iat: payload.iat
  }));

  const isValid = crypto.verify(null, Buffer.from(parts[0] + '.' + parts[1]), keyObject, signature);
  console.log('Signature valid:', isValid);
  if (!isValid) throw new Error('Invalid EdDSA signature');

  const now = Math.floor(Date.now() / 1000);
  console.log('Current time:', now, 'exp:', payload.exp, 'iat:', payload.iat);
  if (payload.exp && payload.exp < now) throw new Error('Token expired');
  if (payload.iat && payload.iat > now + 300) throw new Error('Token issued in future');
  if (payload.iss !== 'tantra-sarathi') throw new Error('Invalid issuer');
  if (payload.aud !== 'tantra-bridge') throw new Error('Invalid audience');
  if (!payload.jti) throw new Error('Missing jti');
  if (!payload.trace_id || !payload.execution_id) throw new Error('Missing trace/exec id');

  return payload;
}

async function main() {
  // Get a token from Sarathi
  const tokenBody = JSON.stringify({
    trace_id: 'test-main-011',
    execution_id: 'test-main-012',
    cet_hash: 'test-main-hash'
  });
  
  const token = await new Promise((resolve, reject) => {
    const req = http.request(SARATHI_URL + '/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data).token); }
        catch(e) { reject(e); }
      });
    });
    req.write(tokenBody);
    req.end();
  });
  
  console.log('Token obtained');
  
  const keys = await fetchJwks();
  console.log('JWKS keys:', keys.length);
  
  const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
  console.log('Token kid:', header.kid);
  
  const jwk = resolveJwk(keys, header.kid);
  console.log('Resolved JWK kid:', jwk.kid, 'type:', jwk.kty);
  
  try {
    const payload = verifyEdDSAToken(token, jwk);
    console.log('VERIFICATION SUCCESS:', JSON.stringify({...payload, jti: '***'}));
  } catch(e) {
    console.log('VERIFICATION FAILED:', e.message);
  }
}

main().catch(e => console.log('FATAL:', e.message, e.stack));
