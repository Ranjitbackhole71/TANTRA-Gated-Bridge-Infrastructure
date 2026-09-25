const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { requestJson, issueToken } = require('./runtime_helpers');

test('Sarathi issues a token and serves standards-compatible JWKS', async () => {
  const trace = crypto.randomUUID(); const execution = crypto.randomUUID();
  const token = await issueToken(trace, execution, 'sarathi-unit-cet');
  assert.equal(token.trace_id, trace);
  assert.equal(token.execution_id, execution);
  assert.ok(token.jti);
  assert.ok(['EdDSA', 'RS256'].includes(token.algorithm));
  const jwks = await requestJson('http://localhost:3001/.well-known/jwks.json');
  assert.equal(jwks.status, 200);
  assert.ok(jwks.body.keys.some(key => key.kid));
});

test('Sarathi rejects incomplete token requests', async () => {
  const result = await requestJson('http://localhost:3001/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(result.status, 400);
});
