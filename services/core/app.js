const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const { requestMasterdbToken } = require('./masterdb_auth');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
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

const PORT = process.env.PORT || 3000;
const SARATHI_URL = process.env.SARATHI_URL || 'http://localhost:3001';
const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:3002';
const SARATHI_TIMEOUT_MS = parseInt(process.env.SARATHI_TIMEOUT_MS) || 25000;
const BRIDGE_TIMEOUT_MS = parseInt(process.env.BRIDGE_TIMEOUT_MS) || 30000;
const INSIGHTFLOW_URL = process.env.INSIGHTFLOW_URL || 'http://localhost:3005';
const masterdbBaseUrl = new URL(process.env.MASTERDB_BASE_URL || 'http://163.128.209.18:30308');
if (masterdbBaseUrl.pathname.replace(/\/+$/, '') === '/docs') {
  masterdbBaseUrl.pathname = '/';
}
if (
  process.env.MASTERDB_CONTAINERIZED === 'true' &&
  ['localhost', '127.0.0.1', '::1'].includes(masterdbBaseUrl.hostname)
) {
  masterdbBaseUrl.hostname = 'host.docker.internal';
}
const MASTERDB_BASE_URL = masterdbBaseUrl.toString().replace(/\/+$/, '');
const MASTERDB_AUTH_ACTOR = process.env.MASTERDB_AUTH_ACTOR;
const MASTERDB_AUTH_PASSWORD = process.env.MASTERDB_AUTH_PASSWORD || process.env.AUTH_PASSWORD;
let masterdbAccessToken = null;

async function getMasterdbAccessToken() {
  if (masterdbAccessToken) return masterdbAccessToken;
  const token = await requestMasterdbToken({
    axios,
    baseUrl: MASTERDB_BASE_URL,
    actor: MASTERDB_AUTH_ACTOR,
    password: MASTERDB_AUTH_PASSWORD
  });
  masterdbAccessToken = token;
  return token;
}

app.get('/health', (req, res) => {
  res.json({ service: 'core', status: 'healthy' });
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'TANTRA Core Service API'
}));

app.get('/docs.json', (req, res) => {
  res.type('application/json').send(swaggerSpec);
});

app.get('/masterdb/capabilities', async (req, res) => {
  try {
    const token = await getMasterdbAccessToken();
    const params = {};
    for (const key of ['domain', 'status', 'search']) {
      if (typeof req.query[key] === 'string' && req.query[key]) {
        params[key] = req.query[key];
      }
    }

    const response = await axios.get(
      `${MASTERDB_BASE_URL}/tantra/capabilities`,
      {
        params,
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000
      }
    );
    return res.status(response.status).json(response.data);
  } catch (err) {
    const upstreamStatus = err.response ? err.response.status : null;
    log(null, null, 'core', 'error', `MasterDB capabilities request failed (upstream status: ${upstreamStatus || 'unavailable'})`);
    return res.status(502).json({
      error: 'MasterDB capabilities request failed',
      upstream_status: upstreamStatus
    });
  }
});

app.get('/masterdb/capabilities/:capabilityId/contract', async (req, res) => {
  try {
    const token = await getMasterdbAccessToken();
    const capabilityId = encodeURIComponent(req.params.capabilityId);
    const response = await axios.get(
      `${MASTERDB_BASE_URL}/tantra/capabilities/${capabilityId}/contract`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000
      }
    );
    return res.status(response.status).json(response.data);
  } catch (err) {
    const upstreamStatus = err.response ? err.response.status : null;
    log(null, null, 'core', 'error', `MasterDB capability contract request failed (upstream status: ${upstreamStatus || 'unavailable'})`);
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    return res.status(502).json({
      error: 'MasterDB capability contract request failed',
      upstream_status: null
    });
  }
});

app.post('/masterdb/access/request', async (req, res) => {
  try {
    const token = await getMasterdbAccessToken();
    const response = await axios.post(
      `${MASTERDB_BASE_URL}/tantra/access/request`,
      req.body,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000
      }
    );
    return res.status(response.status).json(response.data);
  } catch (err) {
    const upstreamStatus = err.response ? err.response.status : null;
    log(null, null, 'core', 'error', `MasterDB access request failed (upstream status: ${upstreamStatus || 'unavailable'})`);
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    return res.status(502).json({
      error: 'MasterDB access request failed',
      upstream_status: null
    });
  }
});

app.post('/masterdb/capabilities/:capabilityId/retrieve', async (req, res) => {
  try {
    const token = await getMasterdbAccessToken();
    const { filters, ...payload } = req.body;
    if (filters && !payload.query_params) {
      payload.query_params = filters;
    }

    const capabilityId = encodeURIComponent(req.params.capabilityId);
    const response = await axios.post(
      `${MASTERDB_BASE_URL}/tantra/capabilities/${capabilityId}/retrieve`,
      payload,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000
      }
    );
    return res.status(response.status).json(response.data);
  } catch (err) {
    const upstreamStatus = err.response ? err.response.status : null;
    log(null, null, 'core', 'error', `MasterDB capability retrieval failed (upstream status: ${upstreamStatus || 'unavailable'})`);
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    return res.status(502).json({
      error: 'MasterDB capability retrieval failed',
      upstream_status: null
    });
  }
});

app.get('/diagnostic/sarathi-health', async (req, res) => {
  const url = `${SARATHI_URL}/health`;
  const start = Date.now();
  try {
    const response = await axios.get(url, { timeout: 10000 });
    res.json({
      resolved_url: url,
      status: response.status,
      body: response.data,
      duration_ms: Date.now() - start,
      env: {
        http_proxy_set: !!process.env.HTTP_PROXY || !!process.env.http_proxy,
        https_proxy_set: !!process.env.HTTPS_PROXY || !!process.env.https_proxy,
        no_proxy_set: !!(process.env.NO_PROXY || process.env.no_proxy),
        no_proxy_value: process.env.NO_PROXY || process.env.no_proxy || null
      },
      runtime: {
        node_version: process.version,
        axios_version: axios.VERSION || null
      }
    });
  } catch (err) {
    res.json({
      resolved_url: url,
      status: err.response ? err.response.status : null,
      error_code: err.code || null,
      error_message: err.message,
      duration_ms: Date.now() - start,
      env: {
        http_proxy_set: !!process.env.HTTP_PROXY || !!process.env.http_proxy,
        https_proxy_set: !!process.env.HTTPS_PROXY || !!process.env.https_proxy,
        no_proxy_set: !!(process.env.NO_PROXY || process.env.no_proxy),
        no_proxy_value: process.env.NO_PROXY || process.env.no_proxy || null
      },
      runtime: {
        node_version: process.version,
        axios_version: axios.VERSION || null
      }
    });
  }
});

app.get('/telemetry/summary', async (req, res) => {
  try {
    const resp = await axios.get(`${INSIGHTFLOW_URL}/telemetry/summary`, { timeout: 5000 });
    res.json(resp.data);
  } catch (err) {
    res.status(503).json({ error: 'InsightFlow unavailable' });
  }
});

app.get('/telemetry', async (req, res) => {
  try {
    const url = new URL(`${INSIGHTFLOW_URL}/telemetry`);
    if (req.query.trace_id) url.searchParams.set('trace_id', req.query.trace_id);
    if (req.query.limit) url.searchParams.set('limit', req.query.limit);
    const resp = await axios.get(url.toString(), { timeout: 5000 });
    res.json(resp.data);
  } catch (err) {
    res.status(503).json({ error: 'InsightFlow unavailable' });
  }
});

app.post('/initiate', async (req, res) => {
  const trace_id = crypto.randomUUID();
  const execution_id = crypto.randomUUID();
  const cet_hash = crypto.createHash('sha256').update(trace_id + ':' + execution_id).digest('hex');

  log(trace_id, execution_id, 'core', 'info', `Workflow initiated, cet_hash: ${cet_hash}`);

  try {
    log(trace_id, execution_id, 'core', 'info', 'Requesting token from Sarathi');

    const tokenResponse = await axios.post(
      `${SARATHI_URL}/token`,
      { trace_id, execution_id, cet_hash },
      { timeout: SARATHI_TIMEOUT_MS }
    );

    const { token } = tokenResponse.data;
    log(trace_id, execution_id, 'core', 'info', `Token received from Sarathi (algorithm: ${tokenResponse.data.algorithm || 'unknown'})`);

    log(trace_id, execution_id, 'core', 'info', 'Forwarding to Bridge');

    const bridgeResponse = await axios.post(
      `${BRIDGE_URL}/execute`,
      {
        ...req.body,
        trace_id,
        execution_id,
        cet_hash
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Sarathi-Trace-Id': trace_id,
          'X-Sarathi-Execution-Id': execution_id,
          'X-Sarathi-Cet-Hash': cet_hash
        },
        timeout: BRIDGE_TIMEOUT_MS
      }
    );

    log(trace_id, execution_id, 'core', 'success', 'Workflow completed successfully');
    res.json({
      trace_id,
      execution_id,
      cet_hash,
      status: 'completed',
      result: bridgeResponse.data
    });
  } catch (err) {
    log(trace_id, execution_id, 'core', 'error', `Workflow failed: ${err.message}`);

    if (err.response) {
      return res.status(err.response.status).json({
        ...err.response.data,
        trace_id,
        execution_id,
        cet_hash
      });
    }

    return res.status(503).json({
      error: 'System stopped: dependency unavailable',
      trace_id,
      execution_id,
      cet_hash
    });
  }
});

const server = app.listen(PORT, () => {
  log(null, null, 'core', 'info', `Core Service running on port ${PORT}`);
});

function gracefulShutdown(signal) {
  log(null, null, 'core', 'info', `Received ${signal}, shutting down gracefully`);
  server.close(() => {
    log(null, null, 'core', 'info', 'Server closed');
    process.exit(0);
  });
  setTimeout(() => {
    log(null, null, 'core', 'warn', 'Forced shutdown after timeout');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
