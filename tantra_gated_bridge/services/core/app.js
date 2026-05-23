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

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ service: 'core', status: 'healthy' });
});

// Initiate workflow
app.post('/initiate', async (req, res) => {
  // Generate immutable trace_id and execution_id
  const trace_id = crypto.randomUUID();
  const execution_id = crypto.randomUUID();
  
  log(trace_id, execution_id, 'core', 'info', 'Workflow initiated');

  try {
    // Step 1: Get token from Sarathi Authority
    log(trace_id, execution_id, 'core', 'info', 'Requesting token from Sarathi');
    
    const tokenResponse = await axios.post(
      `${SARATHI_URL}/token`,
      { trace_id, execution_id },
      { timeout: 5000 }
    );

    const { token } = tokenResponse.data;
    log(trace_id, execution_id, 'core', 'info', 'Token received from Sarathi');

    // Step 2: Forward to Bridge with token
    log(trace_id, execution_id, 'core', 'info', 'Forwarding to Bridge');
    
    const bridgeResponse = await axios.post(
      `${BRIDGE_URL}/execute`,
      { 
        ...req.body,
        trace_id,
        execution_id
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    log(trace_id, execution_id, 'core', 'success', 'Workflow completed successfully');
    res.json({
      trace_id,
      execution_id,
      status: 'completed',
      result: bridgeResponse.data
    });
  } catch (err) {
    // HARD FAIL: If any dependency fails, system stops immediately
    log(trace_id, execution_id, 'core', 'error', `Workflow failed: ${err.message}`);
    
    if (err.response) {
      return res.status(err.response.status).json({
        ...err.response.data,
        trace_id,
        execution_id
      });
    }
    
    return res.status(503).json({ 
      error: 'System stopped: dependency unavailable',
      trace_id,
      execution_id
    });
  }
});

app.listen(PORT, () => {
  log(null, null, 'core', 'info', `Core Service running on port ${PORT}`);
});
