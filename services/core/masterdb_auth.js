async function requestMasterdbToken({ axios, baseUrl, actor, password }) {
  if (!actor) throw new Error('MASTERDB_AUTH_ACTOR is not configured');
  if (!password) throw new Error('MASTERDB_AUTH_PASSWORD is not configured');

  const response = await axios.post(
    `${baseUrl}/auth/token`,
    { actor, password },
    { timeout: 15000 }
  );
  const token = response.data && response.data.access_token;
  if (!token) throw new Error('MasterDB did not return an access token');
  return token;
}

module.exports = { requestMasterdbToken };
