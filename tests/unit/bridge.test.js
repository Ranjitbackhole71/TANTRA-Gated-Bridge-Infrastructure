const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { requestJson, issueToken, bridgeExecute } = require('./runtime_helpers');

const sarathiPort = 33101;
const bridgePort = 33102;
const keyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tantra-sarathi-unit-'));
const replayDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tantra-bridge-replay-unit-'));
let children = [];

function start(script, cwd, env) {
  const child = spawn(process.execPath, [script], { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  return child;
}

async function waitForHealth(url) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const result = await requestJson(url);
      if (result.status === 200) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

test.before(async () => {
  start('app.js', path.resolve('services/sarathi'), {
    PORT: String(sarathiPort),
    JWT_EXPIRY_MS: '100',
    SARATHI_KEY_DIR: keyDir
  });
  await waitForHealth(`http://localhost:${sarathiPort}/health`);
  start('app.js', path.resolve('services/bridge'), {
    PORT: String(bridgePort),
    SARATHI_URL: `http://localhost:${sarathiPort}`,
    EXECUTION_URL: 'http://127.0.0.1:9',
    REPLAY_STORAGE_DIR: replayDir,
    INSIGHTFLOW_ENABLED: 'false'
  });
  await waitForHealth(`http://localhost:${bridgePort}/health`);
});

test.after(() => {
  for (const child of children) child.kill('SIGTERM');
  fs.rmSync(keyDir, { recursive: true, force: true });
  fs.rmSync(replayDir, { recursive: true, force: true });
});

function body(trace_id, execution_id, cet_hash) {
  return { workload: 'bridge-unit', trace_id, execution_id, cet_hash };
}

test('Bridge accepts a valid Sarathi token and rejects invalid/tampered tokens', async () => {
  const trace = crypto.randomUUID(); const execution = crypto.randomUUID(); const cet = 'cet-valid';
  const issued = await issueToken(trace, execution, cet, `http://localhost:${sarathiPort}`);
  const accepted = await bridgeExecute(issued.token, body(trace, execution, cet), `http://localhost:${bridgePort}`);
  assert.equal(accepted.status, 503, 'valid token reaches downstream even when test endpoint is unavailable');

  const tampered = `${issued.token.slice(0, -1)}${issued.token.endsWith('a') ? 'b' : 'a'}`;
  const rejected = await bridgeExecute(tampered, body(crypto.randomUUID(), crypto.randomUUID(), cet), `http://localhost:${bridgePort}`);
  assert.equal(rejected.status, 401);
});

test('Bridge rejects expiry, unknown kid, trace/execution mutation, CET mismatch, and JTI replay', async () => {
  const trace = crypto.randomUUID(); const execution = crypto.randomUUID(); const cet = 'cet-negative';
  const expired = await issueToken(trace, execution, cet, `http://localhost:${sarathiPort}`);
  await new Promise(resolve => setTimeout(resolve, 1200));
  assert.equal((await bridgeExecute(expired.token, body(trace, execution, cet), `http://localhost:${bridgePort}`)).status, 401);

  const unknownKid = await issueToken(crypto.randomUUID(), crypto.randomUUID(), cet, `http://localhost:${sarathiPort}`);
  const parts = unknownKid.token.split('.');
  const unknownHeader = Buffer.from(JSON.stringify({ alg: 'EdDSA', kid: 'unknown-kid', typ: 'JWT' })).toString('base64url');
  assert.equal((await bridgeExecute(`${unknownHeader}.${parts[1]}.${parts[2]}`, body(crypto.randomUUID(), crypto.randomUUID(), cet), `http://localhost:${bridgePort}`)).status, 401);

  const traceToken = await issueToken(crypto.randomUUID(), crypto.randomUUID(), cet, `http://localhost:${sarathiPort}`);
  assert.equal((await bridgeExecute(traceToken.token, body('mutated-trace', traceToken.execution_id, cet), `http://localhost:${bridgePort}`)).status, 400);
  const executionToken = await issueToken(crypto.randomUUID(), crypto.randomUUID(), cet, `http://localhost:${sarathiPort}`);
  assert.equal((await bridgeExecute(executionToken.token, body(executionToken.trace_id, 'mutated-execution', cet), `http://localhost:${bridgePort}`)).status, 400);
  const cetToken = await issueToken(crypto.randomUUID(), crypto.randomUUID(), cet, `http://localhost:${sarathiPort}`);
  assert.equal((await bridgeExecute(cetToken.token, body(cetToken.trace_id, cetToken.execution_id, 'wrong-cet'), `http://localhost:${bridgePort}`)).status, 400);
  const replayToken = await issueToken(crypto.randomUUID(), crypto.randomUUID(), cet, `http://localhost:${sarathiPort}`);
  const replayBody = body(replayToken.trace_id, replayToken.execution_id, cet);
  assert.equal((await bridgeExecute(replayToken.token, replayBody, `http://localhost:${bridgePort}`)).status, 503);
  assert.equal((await bridgeExecute(replayToken.token, replayBody, `http://localhost:${bridgePort}`)).status, 401);
});
