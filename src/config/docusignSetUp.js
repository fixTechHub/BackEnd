const docusign = require('docusign-esign');

// Cached instance of the API client, account ID, and token expiration
let dsApiClient = null;
let accountId = null;
let tokenExpiration = null;

const initializeApiClient = async () => {
  const client = new docusign.ApiClient();
  const basePath = process.env.DOCUSIGN_API_URL || 'https://demo.docusign.net/restapi';
  client.setBasePath(basePath);
  const privateKey = Buffer.from(process.env.DOCUSIGN_PRIVATE_KEY, 'base64').toString('utf8');

  try {
    const requiredEnvVars = ['DOCUSIGN_INTEGRATION_KEY', 'DOCUSIGN_USER_ID', 'DOCUSIGN_PRIVATE_KEY'];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    const results = await client.requestJWTUserToken(
      process.env.DOCUSIGN_INTEGRATION_KEY,
      process.env.DOCUSIGN_USER_ID,
      'signature impersonation',
      privateKey,
      3600
    );

    console.log('JWT Token obtained successfully. Initializing singleton client.');
    client.addDefaultHeader('Authorization', 'Bearer ' + results.body.access_token);

    const expiresInSeconds = results.body.expires_in || 3600;
    tokenExpiration = Date.now() + (expiresInSeconds * 1000);

    const userInfo = await client.getUserInfo(results.body.access_token);
    const account = userInfo.accounts.find(acc => acc.isDefault) || userInfo.accounts[0];
    if (!account) {
      throw new Error('No accounts found for the authenticated user.');
    }

    dsApiClient = client;
    accountId = account.accountId;
    return { dsApiClient, accountId };
  } catch (error) {
    console.error('JWT Token Error Details:', {
      message: error.message,
      response: error.response?.data || error.response,
      status: error.response?.status,
      config: {
        integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY,
        userId: process.env.DOCUSIGN_USER_ID,
        basePath: client.basePath
      }
    });

    if (error.response?.data?.error === 'consent_required') {
      const consentUrl = `https://account-d.docusign.net/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${process.env.DOCUSIGN_INTEGRATION_KEY}&redirect_uri=https://www.docusign.com`;
      console.error('User consent required. Visit this URL to grant consent:');
      console.error(consentUrl);
      throw new Error('User consent required. Visit the consent URL above.');
    }

    if (error.response?.data?.error) {
      throw new Error(`DocuSign Error: ${error.response.data.error} - ${error.response.data.error_description || 'No description'}`);
    }
    throw error;
  }
};

// Wrapper function to ensure a valid token
const getApiClient = async () => {
  if (!dsApiClient || !accountId || !tokenExpiration || Date.now() >= tokenExpiration) {
    console.log('Token expired or not initialized, refreshing...');
    const { dsApiClient: newClient, accountId: newAccountId } = await initializeApiClient();
    dsApiClient = newClient;
    accountId = newAccountId;
  }
  return { dsApiClient, accountId };
};

module.exports = { getApiClient };