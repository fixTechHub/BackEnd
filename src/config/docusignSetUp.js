const docusign = require('docusign-esign');

// Initialize DocuSign API client with JWT authentication
const initializeApiClient = async () => {
    try {
        const apiClient = new docusign.ApiClient();
        apiClient.setBasePath(process.env.DOCUSIGN_API_URL);
        
        // Decode base64 private key from .env
        const privateKey = Buffer.from(process.env.DOCUSIGN_PRIVATE_KEY, 'base64').toString('utf8');
        
        // Request JWT token for DocuSign
        const jwtResponse = await apiClient.requestJWTUserToken(
            process.env.DOCUSIGN_INTEGRATION_KEY,
            process.env.DOCUSIGN_USER_ID,
            ['signature', 'impersonation'],
            privateKey,
            3600
        );
        
        apiClient.addDefaultHeader('Authorization', `Bearer ${jwtResponse.body.access_token}`);
        
        return apiClient;
    } catch (error) {
        console.error('DocuSign API Client Initialization Error:', error);
        throw new Error('Failed to initialize DocuSign API client');
    }
};

module.exports = { initializeApiClient };