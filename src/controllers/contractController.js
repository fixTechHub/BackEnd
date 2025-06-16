const { sendEnvelopeAndSaveContract, generateSigningUrl, updateContractStatus } = require('../services/contractService');
const { generateToken } = require('../utils/jwt');
const { findUserById } = require('../services/userService')
const { generateContractCode,generateCookie } = require('../utils/generateCode');

// Create and send envelope for signing
const createEnvelope = async (req, res) => {
    try {
        const { technicianId, effectiveDate, expirationDate, documentBase64 } = req.body;
        const user = req.user;

        // Validate input
        if (!technicianId || !effectiveDate || !expirationDate || !documentBase64) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Generate unique contract code
        const contractCode = await generateContractCode();

        // Send envelope and save contract
        const { envelopeId, contractId } = await sendEnvelopeAndSaveContract(user, {
            technicianId,
            contractCode,
            effectiveDate,
            expirationDate,
            documentBase64,
            s3FileUrl: req.s3FileUrl
        });

        // Generate embedded signing URL
        const signingUrl = await generateSigningUrl(user, envelopeId);

        // Generate JWT token and set cookie
        const userToken = await findUserById(user.userId)
        const token = generateToken(userToken);
        generateCookie(token,res)

        res.status(200).json({
            success: true,
            signingUrl,
            contractId,
            contractCode // Return contractCode to frontend if needed
        });
    } catch (error) {
        console.error('Create Envelope Controller Error:', error);
        res.status(500).json({ message: 'Failed to create envelope', error: error.message });
    }
};

// Webhook handler for DocuSign Connect
const handleDocuSignWebhook = async (req, res) => {
    try {
        const { envelopeId, status } = req.body;
        await updateContractStatus({ envelopeId, status });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Webhook Controller Error:', error);
        res.status(500).json({ message: 'Webhook processing failed', error: error.message });
    }
};

module.exports = {
    createEnvelope,
    handleDocuSignWebhook
};