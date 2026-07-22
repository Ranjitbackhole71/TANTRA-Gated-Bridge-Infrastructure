const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
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

app.get('/health', (req, res) => {
  res.json({ service: 'core', status: 'healthy' });
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
