const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'TANTRA Core Service API',
    version: '1.0.0',
    description: 'API documentation for the TANTRA workflow entry point.'
  },
  servers: [{ url: '/' }],
  paths: {
    '/health': {
      get: {
        summary: 'Check Core service health',
        responses: {
          200: {
            description: 'Core service is healthy.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    service: { type: 'string', example: 'core' },
                    status: { type: 'string', example: 'healthy' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/masterdb/capabilities': {
      get: {
        summary: 'List MasterDB capabilities',
        parameters: ['domain', 'status', 'search'].map((name) => ({
          name,
          in: 'query',
          required: false,
          schema: { type: 'string' }
        })),
        responses: {
          200: { description: 'Capabilities returned by MasterDB.' },
          502: { description: 'MasterDB authentication or request failed.' }
        }
      }
    },
    '/masterdb/capabilities/{capabilityId}/contract': {
      get: {
        summary: 'Get a capability contract from MasterDB',
        parameters: [
          {
            name: 'capabilityId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          200: { description: 'Capability contract returned by MasterDB.' },
          401: { description: 'MasterDB rejected the credentials.' },
          403: { description: 'MasterDB denied access to the contract.' },
          404: { description: 'Capability or contract was not found.' },
          502: { description: 'Could not connect to MasterDB.' }
        }
      }
    },
    '/masterdb/access/request': {
      post: {
        summary: 'Request access to a MasterDB capability',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['application_id', 'capability_id', 'purpose'],
                properties: {
                  application_id: { type: 'string' },
                  capability_id: { type: 'string' },
                  capability_version: { type: 'string', nullable: true },
                  purpose: { type: 'string' },
                  request_id: { type: 'string', nullable: true }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Access request processed by MasterDB.' },
          401: { description: 'MasterDB rejected the credentials.' },
          403: { description: 'MasterDB denied the access request.' },
          422: { description: 'Required access request fields are invalid or missing.' },
          502: { description: 'Could not connect to MasterDB.' }
        }
      }
    },
    '/masterdb/capabilities/{capabilityId}/retrieve': {
      post: {
        summary: 'Retrieve data from a MasterDB capability',
        parameters: [
          {
            name: 'capabilityId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  request_id: { type: 'string', nullable: true },
                  application_id: { type: 'string', nullable: true },
                  access_token: { type: 'string', nullable: true },
                  filters: {
                    type: 'object',
                    additionalProperties: true,
                    description: 'Forwarded to MasterDB as query_params.'
                  },
                  query_params: {
                    type: 'object',
                    additionalProperties: true
                  },
                  trace_id: { type: 'string', nullable: true },
                  execution_id: { type: 'string', nullable: true }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Capability data returned by MasterDB.' },
          401: { description: 'MasterDB rejected the credentials or access token.' },
          403: { description: 'Access to the capability was denied.' },
          404: { description: 'Capability was not found.' },
          422: { description: 'Retrieve request is invalid.' },
          502: { description: 'Could not connect to MasterDB.' }
        }
      }
    },
    '/diagnostic/sarathi-health': {
      get: {
        summary: 'Check the Sarathi dependency',
        responses: {
          200: { description: 'Sarathi health or connection diagnostic.' }
        }
      }
    },
    '/telemetry/summary': {
      get: {
        summary: 'Get the telemetry summary',
        responses: {
          200: { description: 'Telemetry summary returned by InsightFlow.' },
          503: { description: 'InsightFlow is unavailable.' }
        }
      }
    },
    '/telemetry': {
      get: {
        summary: 'Query telemetry events',
        parameters: [
          {
            name: 'trace_id',
            in: 'query',
            required: false,
            schema: { type: 'string' }
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          200: { description: 'Telemetry events returned by InsightFlow.' },
          503: { description: 'InsightFlow is unavailable.' }
        }
      }
    },
    '/initiate': {
      post: {
        summary: 'Initiate a TANTRA workflow',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  workload: { type: 'string', description: 'Workload to execute.' }
                },
                additionalProperties: true
              }
            }
          }
        },
        responses: {
          200: { description: 'Workflow completed successfully.' },
          400: { description: 'Workflow request rejected by a downstream service.' },
          503: { description: 'A workflow dependency is unavailable.' }
        }
      }
    }
  }
};

module.exports = swaggerSpec;
