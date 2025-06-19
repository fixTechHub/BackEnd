const docusign = require('docusign-esign');


const initializeApiClient = async () => {
  const dsApiClient = new docusign.ApiClient();
  
  // Set the base path (ensure it’s the correct environment)
  const basePath = process.env.DOCUSIGN_API_URL || 'https://demo.docusign.net/restapi';
  dsApiClient.setBasePath(basePath);
  const privateKey = Buffer.from(process.env.DOCUSIGN_PRIVATE_KEY, 'base64').toString('utf8');
  
  try {
    // Validate required environment variables
    const requiredEnvVars = [
      'DOCUSIGN_INTEGRATION_KEY',
      'DOCUSIGN_USER_ID',
      // 'DOCUSIGN_ACCOUNT_ID' // Remove this; we’ll fetch it dynamically
    ];
    
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

   
    // Request JWT token with proper parameters
    const results = await dsApiClient.requestJWTUserToken(
      process.env.DOCUSIGN_INTEGRATION_KEY,
      process.env.DOCUSIGN_USER_ID,
      'signature impersonation', // Include both scopes
      privateKey,
      3600
    );

    console.log('JWT Token obtained successfully');
    
    // Set the authorization header
    dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + results.body.access_token);
    
    // Fetch account ID dynamically
    const userInfo = await dsApiClient.getUserInfo(results.body.access_token);
    const account = userInfo.accounts.find(acc => acc.isDefault) || userInfo.accounts[0];
    if (!account) {
      throw new Error('No accounts found for the authenticated user.');
    }
    
    return { dsApiClient, accountId: account.accountId };
    
  } catch (error) {
    console.error('JWT Token Error Details:', {
      message: error.message,
      response: error.response?.data || error.response,
      status: error.response?.status,
    });
    
    if (error.response?.data?.error === 'consent_required') {
      const consentUrl = `https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${process.env.DOCUSIGN_INTEGRATION_KEY}&redirect_uri=https://www.docusign.com`;
      console.error('User consent required. Visit this URL to grant consent:');
      console.error(consentUrl);
      throw new Error('User consent required. Visit the consent URL above.');
    }
    
    throw error;
  }
};

module.exports = { initializeApiClient };