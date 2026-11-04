const test = require('node:test');
const assert = require('node:assert/strict');
const { requestMasterdbToken } = require('./masterdb_auth');

test('MasterDB token request sends the configured actor', async () => {
  const calls = [];
  const axios = {
    post: async (...args) => {
      calls.push(args);
      return { data: { access_token: 'test-token' } };
    }
  };

  const token = await requestMasterdbToken({
    axios,
    baseUrl: 'http://masterdb.test',
    actor: 'TANTRA_TEST_ACTOR',
    password: 'test-password'
  });

  assert.equal(token, 'test-token');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'http://masterdb.test/auth/token');
  assert.deepEqual(calls[0][1], {
    actor: 'TANTRA_TEST_ACTOR',
    password: 'test-password'
  });
});
