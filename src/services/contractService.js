const docusign = require('docusign-esign');
const Contract = require('../models/Contract');
const { initializeApiClient } = require('../config/docusignSetUp');

// Create a DocuSign envelope
const createEnvelopeDefinition = (user, {  contractCode, effectiveDate, expirationDate, documentBase64 }) => {
    // Decode base64 document
    const documentBuffer = Buffer.from(documentBase64, 'base64');

    // Create document
    const doc = docusign.Document.constructFromObject({
        documentBase64: documentBuffer.toString('base64'),
        name: `Contract_${contractCode}.pdf`,
        fileExtension: 'pdf',
        documentId: '1'
    });

    // Create recipient
    const signer = docusign.Signer.constructFromObject({
        email: user.email,
        name: user.fullName,
        recipientId: user.userId,
        routingOrder: '1'
    });

    // Create sign here tab
    const signHere = docusign.SignHere.constructFromObject({
        documentId: '1',
        pageNumber: '1',
        xPosition: '100',
        yPosition: '100'
    });

    // Create tabs object
    const tabs = docusign.Tabs.constructFromObject({
        signHereTabs: [signHere]
    });
    signer.tabs = tabs;

    // Create custom fields for metadata
    const customFields = [
        docusign.TextCustomField.constructFromObject({
            name: 'EffectiveDate',
            value: new Date(effectiveDate).toISOString(),
            show: 'true',
            required: 'false'
        }),
        docusign.TextCustomField.constructFromObject({
            name: 'ExpirationDate',
            value: new Date(expirationDate).toISOString(),
            show: 'true',
            required: 'false'
        })
    ];
    if (new Date(expirationDate) <= new Date()) {
        throw new Error('Expiration date must be in the future');
    }
    // Create envelope definition
    return docusign.EnvelopeDefinition.constructFromObject({
        emailSubject: `Please sign contract ${contractCode} for Technician ${user.fullName} (Effective: ${new Date(effectiveDate).toLocaleDateString()})`,
        emailBlurb: `Contract ${contractCode} for Technician ${user.fullName}, effective from ${new Date(effectiveDate).toLocaleDateString()} to ${new Date(expirationDate).toLocaleDateString()}.`,
        documents: [doc],
        recipients: docusign.Recipients.constructFromObject({
            signers: [signer]
        }),
        customFieldsList: customFields,
        notification: docusign.Notification.constructFromObject({
            useAccountDefaults: 'false',
            expirations: docusign.Expirations.constructFromObject({
                expireEnabled: 'true',
                expireAfter: Math.ceil((new Date(expirationDate) - new Date()) / (1000 * 60 * 60 * 24)), // Days until expiration
                expireWarn: 2 // Warn 2 days before
            })
        }),
        status: 'sent'
    });
};

// Send envelope and save contract
const sendEnvelopeAndSaveContract = async (user, { technicianId, contractCode, effectiveDate, expirationDate, documentBase64, s3FileUrl }) => {
    try {
        const apiClient = await initializeApiClient();
        const envelopesApi = new docusign.EnvelopesApi(apiClient);

        // Create envelope definition
        const envelopeDefinition = createEnvelopeDefinition(user, {
            contractCode,
            effectiveDate,
            expirationDate,
            documentBase64
        });

        // Send envelope
        const envelope = await envelopesApi.createEnvelope(process.env.DOCUSIGN_ACCOUNT_ID, {
            envelopeDefinition
        });

        // Save contract to MongoDB
        const contract = new Contract({
            technicianId,
            contractCode,
            effectiveDate: new Date(effectiveDate),
            expirationDate: new Date(expirationDate),
            content: s3FileUrl || documentBase64,
            status: 'PENDING',
            docusignEnvelopeId: envelope.envelopeId
        });

        await contract.save();

        return { envelopeId: envelope.envelopeId, contractId: contract._id };
    } catch (error) {
        console.error('Send Envelope Error:', error);
        throw new Error('Failed to send envelope or save contract');
    }
};

// Generate embedded signing URL
const generateSigningUrl = async (user, envelopeId) => {
    try {
        const apiClient = await initializeApiClient();
        const envelopesApi = new docusign.EnvelopesApi(apiClient);

        const recipientView = await envelopesApi.createRecipientView(
            process.env.DOCUSIGN_ACCOUNT_ID,
            envelopeId,
            {
                recipientViewRequest: docusign.RecipientViewRequest.constructFromObject({
                    authenticationMethod: 'none',
                    email: user.email,
                    name: user.fullName,
                    userId: user.userId,
                    clientUserId: user.userId,
                    returnUrl: `${process.env.FRONTEND_URL}/contract/complete`
                })
            }
        );

        return recipientView.url;
    } catch (error) {
        console.error('Generate Signing URL Error:', error);
        throw new Error('Failed to generate signing URL');
    }
};

// Handle webhook status updates
const updateContractStatus = async ({ envelopeId, status }) => {
    try {
        const contract = await Contract.findOne({ docusignEnvelopeId: envelopeId });
        if (!contract) {
            throw new Error('Contract not found');
        }

        // Update contract status based on DocuSign event
        switch (status) {
            case 'completed':
                contract.status = 'SIGNED';
                contract.signedAt = new Date();
                break;
            case 'declined':
                contract.status = 'REJECTED';
                break;
            case 'voided':
                contract.status = 'EXPIRED';
                break;
            default:
                throw new Error(`Invalid status: ${status}`);
        }

        await contract.save();
        return contract;
    } catch (error) {
        console.error('Update Contract Status Error:', error);
        throw error;
    }
};

module.exports = {
    createEnvelopeDefinition,
    sendEnvelopeAndSaveContract,
    generateSigningUrl,
    updateContractStatus
};