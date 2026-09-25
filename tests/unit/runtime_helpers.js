const assert = require('node:assert/strict');

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, status: response.status, body };
}

async function issueToken(traceId, executionId, cetHash, baseUrl = 'http://localhost:3001') {
  const result = await requestJson(`${baseUrl}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ trace_id: traceId, execution_id: executionId, cet_hash: cetHash })
  });
  assert.equal(result.status, 200);
  return result.body;
}

async function bridgeExecute(token, body, baseUrl = 'http://localhost:3002') {
  return requestJson(`${baseUrl}/execute`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'x-sarathi-trace-id': body.trace_id,
      'x-sarathi-execution-id': body.execution_id,
      'x-sarathi-cet-hash': body.cet_hash
    },
    body: JSON.stringify(body)
  });
}

async function runCore(workload) {
  const result = await requestJson('http://localhost:3000/initiate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workload })
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.status, 'completed');
  return result.body;
}

async function waitForTelemetry(traceId, minimum = 1) {
  for (let i = 0; i < 30; i += 1) {
    const result = await requestJson(`http://localhost:3005/telemetry/${traceId}`);
    if (result.status === 200 && result.body.count >= minimum) return result.body;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for telemetry for ${traceId}`);
}

module.exports = { requestJson, issueToken, bridgeExecute, runCore, waitForTelemetry };
