const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const base = {
  core: 'http://localhost:3000',
  sarathi: 'http://localhost:3001',
  bridge: 'http://localhost:3002',
  execution: 'http://localhost:3003',
  bucket: 'http://localhost:3004',
  insightflow: 'http://localhost:3005'
};

async function request(service, route, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${base[service]}${route}`, {
    method,
    headers: body === undefined ? headers : { ...headers, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { response, status: response.status, body: data };
}

const uuid = () => crypto.randomUUID();
const context = {};

test('live API contracts: Core, Sarathi, Bridge, Execution, Bucket and InsightFlow', async (t) => {
  await t.test('Core GET health and diagnostic; POST initiate creates a real trace', async () => {
    const health = await request('core', '/health');
    assert.equal(health.response.status, 200);
    assert.equal(health.body.service, 'core');
    assert.equal(health.body.status, 'healthy');

    const diagnostic = await request('core', '/diagnostic/sarathi-health');
    assert.equal(diagnostic.response.status, 200);
    assert.equal(typeof diagnostic.body.resolved_url, 'string');
    assert.equal(typeof diagnostic.body.status, 'number');
    assert.ok(diagnostic.body.body);

    const execution = await request('core', '/initiate', {
      method: 'POST', body: { workload: `api-contract-${uuid()}` }
    });
    assert.equal(execution.response.status, 200);
    assert.equal(execution.body.status, 'completed');
    assert.equal(typeof execution.body.trace_id, 'string');
    assert.equal(typeof execution.body.execution_id, 'string');
    assert.equal(execution.body.result.trace_id, execution.body.trace_id);
    assert.equal(execution.body.result.execution_id, execution.body.execution_id);
    context.coreExecution = execution.body;
  });

  await t.test('Sarathi GET health, token, public-key and both JWKS routes', async () => {
    const health = await request('sarathi', '/health');
    assert.equal(health.response.status, 200);
    assert.equal(health.body.service, 'sarathi');
    assert.ok(Array.isArray(health.body.algorithms));

    const trace_id = `api-contract-sarathi-${uuid()}`;
    const execution_id = uuid();
    const token = await request('sarathi', '/token', {
      method: 'POST', body: { trace_id, execution_id, cet_hash: 'contract-cet' }
    });
    assert.equal(token.response.status, 200);
    assert.equal(token.body.trace_id, trace_id);
    assert.equal(token.body.execution_id, execution_id);
    assert.equal(typeof token.body.token, 'string');
    assert.equal(typeof token.body.jti, 'string');
    context.bridgeToken = token.body;

    const invalid = await request('sarathi', '/token', { method: 'POST', body: { trace_id } });
    assert.equal(invalid.response.status, 400);
    assert.equal(typeof invalid.body.error, 'string');

    const publicKey = await request('sarathi', '/public-key');
    assert.equal(publicKey.response.status, 200);
    assert.equal(typeof publicKey.body.public_key, 'string');
    for (const route of ['/jwks', '/.well-known/jwks.json']) {
      const jwks = await request('sarathi', route);
      assert.equal(jwks.response.status, 200);
      assert.ok(Array.isArray(jwks.body.keys));
      assert.ok(jwks.body.keys.some(key => key.alg === 'EdDSA'));
      assert.ok(jwks.body.keys.some(key => key.alg === 'RS256'));
    }
  });

  await t.test('Bridge GET health and authenticated POST execute contract', async () => {
    const health = await request('bridge', '/health');
    assert.equal(health.response.status, 200);
    assert.equal(health.body.service, 'bridge');

    const unauthenticated = await request('bridge', '/execute', {
      method: 'POST', body: { workload: 'contract-invalid-auth' }
    });
    assert.equal(unauthenticated.response.status, 401);
    assert.equal(typeof unauthenticated.body.error, 'string');

    const token = context.bridgeToken;
    const { trace_id, execution_id } = token;
    const body = { workload: `api-contract-bridge-${uuid()}`, trace_id, execution_id, cet_hash: 'contract-cet' };
    const valid = await request('bridge', '/execute', {
      method: 'POST', body,
      headers: {
        authorization: `Bearer ${token.token}`,
        'x-sarathi-trace-id': trace_id,
        'x-sarathi-execution-id': execution_id,
        'x-sarathi-cet-hash': body.cet_hash
      }
    });
    assert.equal(valid.response.status, 200);
    assert.equal(valid.body.trace_id, trace_id);
    assert.equal(valid.body.execution_id, execution_id);
    assert.ok(valid.body.result);
  });

  await t.test('Execution GET health and POST run authentication, continuity, and response', async () => {
    const health = await request('execution', '/health');
    assert.equal(health.response.status, 200);
    assert.equal(health.body.service, 'execution');

    const openapi = await request('execution', '/docs.json');
    assert.equal(openapi.response.status, 200);
    assert.equal(typeof openapi.body, 'object');
    assert.ok(openapi.body.paths['/run']);
    const swagger = await request('execution', '/docs');
    assert.equal(swagger.response.status, 200);
    assert.match(swagger.response.headers.get('content-type') || '', /text\/html/);

    const missingAuth = await request('execution', '/run', {
      method: 'POST', body: { workload: 'contract-no-auth', trace_id: 't', execution_id: 'e' }
    });
    assert.equal(missingAuth.response.status, 401);
    assert.equal(typeof missingAuth.body.error, 'string');

    const trace_id = `api-contract-execution-${uuid()}`;
    const execution_id = uuid();
    const token = await request('sarathi', '/token', {
      method: 'POST', body: { trace_id, execution_id }
    });
    assert.equal(token.response.status, 200);
    const valid = await request('execution', '/run', {
      method: 'POST',
      body: { workload: `api-contract-execution-${uuid()}`, trace_id, execution_id, bridge_signature: `Bearer ${token.body.token}` }
    });
    assert.equal(valid.response.status, 200);
    assert.equal(valid.body.trace_id, trace_id);
    assert.equal(valid.body.execution_id, execution_id);
    assert.equal(valid.body.status, 'completed');

    const mutated = await request('execution', '/run', {
      method: 'POST',
      body: { workload: 'contract-mutated-id', trace_id: 'mutated-trace', execution_id, bridge_signature: `Bearer ${(await request('sarathi', '/token', { method: 'POST', body: { trace_id, execution_id: uuid() } })).body.token}` }
    });
    assert.equal(mutated.response.status, 400);
    assert.equal(typeof mutated.body.error, 'string');
  });

  await t.test('Bucket GET health, POST store and GET retrieve metadata contract', async () => {
    const health = await request('bucket', '/health');
    assert.equal(health.response.status, 200);
    assert.equal(health.body.service, 'bucket');

    const trace_id = `api-contract-bucket-${uuid()}`;
    const execution_id = uuid();
    const payload = { trace_id, execution_id, result: { contract: true, marker: uuid() }, duration_ms: 3 };
    const stored = await request('bucket', '/store', { method: 'POST', body: payload });
    assert.equal(stored.response.status, 201);
    assert.equal(stored.body.verified, true);
    assert.equal(stored.body.metadata.trace_id, trace_id);
    assert.equal(stored.body.metadata.execution_id, execution_id);
    assert.equal(stored.body.metadata.artifact_id, stored.body.location);

    const retrieved = await request('bucket', `/retrieve/${trace_id}/${execution_id}`);
    assert.equal(retrieved.response.status, 200);
    assert.deepEqual(retrieved.body.result, payload.result);
    assert.equal(retrieved.body.metadata.artifact_id, stored.body.location);
    assert.equal(retrieved.body.metadata.hash, stored.body.hash);

    const missingFields = await request('bucket', '/store', {
      method: 'POST', body: { trace_id, execution_id }
    });
    assert.equal(missingFields.response.status, 400);
    assert.equal(typeof missingFields.body.error, 'string');
  });

  await t.test('InsightFlow ingestion, list, summary and trace lookup contract', async () => {
    const health = await request('insightflow', '/health');
    assert.equal(health.response.status, 200);
    assert.equal(health.body.service, 'insightflow-local');
    assert.equal(health.body.status, 'healthy');

    const { trace_id, execution_id } = context.coreExecution;
    const event_type = `api_contract_${uuid()}`;
    const ingestion = await request('insightflow', '/api/v1/telemetry', {
      method: 'POST',
      body: { source: 'api-contract-test', trace_id, execution_id, event_type, status: 'verified', payload: { contract: true } }
    });
    assert.equal(ingestion.response.status, 201);
    assert.equal(ingestion.body.received, true);
    assert.equal(typeof ingestion.body.timestamp, 'string');

    const list = await request('insightflow', `/telemetry?trace_id=${encodeURIComponent(trace_id)}&limit=50`);
    assert.equal(list.response.status, 200);
    assert.equal(list.body.trace_id, trace_id);
    assert.ok(Array.isArray(list.body.events));
    assert.equal(typeof list.body.count, 'number');

    const byTrace = await request('insightflow', `/telemetry/${encodeURIComponent(trace_id)}`);
    assert.equal(byTrace.response.status, 200);
    assert.equal(byTrace.body.trace_id, trace_id);
    assert.ok(Array.isArray(byTrace.body.events));
    assert.ok(byTrace.body.events.some(event => event.event_type === event_type && event.execution_id === execution_id));

    const summary = await request('insightflow', '/telemetry/summary');
    assert.equal(summary.response.status, 200);
    assert.equal(typeof summary.body.total_events, 'number');
    assert.equal(typeof summary.body.unique_traces, 'number');
    assert.ok(Array.isArray(summary.body.traces));
    assert.ok(summary.body.traces.some(trace => trace.trace_id === trace_id && trace.event_count >= 1));
  });
});
