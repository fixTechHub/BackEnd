const docusign = require('docusign-esign');
const { initializeApiClient } = require('../config/docusignSetUp');
const Contract = require('../models/Contract');
const { generateContractCode } = require('../utils/generateCode');

const createContract = async (contractData) => {
  try {
    // Validate FRONT_END_URL
    if (!process.env.FRONT_END_URL || !process.env.FRONT_END_URL.startsWith('http')) {
      throw new Error('FRONTEND_URL must be an absolute URL (e.g., https://yourapp.com)');
    }

    // Generate contract code
    const contractCode = await generateContractCode();

    // Initialize DocuSign API client and get account ID
    const { dsApiClient, accountId } = await initializeApiClient();
    const envelopesApi = new docusign.EnvelopesApi(dsApiClient);

    // Get current date
    const effectiveDate = new Date();
    const day = effectiveDate.getDate().toString();
    const month = (effectiveDate.getMonth() + 1).toString(); // Months are 0-based
    const year = effectiveDate.getFullYear().toString();

    // Create envelope definition using a template
    const envelope = new docusign.EnvelopeDefinition();
    envelope.templateId = process.env.DOCUSIGN_TEMPLATE_ID;
    envelope.status = 'sent';

    // Prepare text tabs for pre-filling with two instances of Day, Month, and Year
    const textTabs = [
      docusign.Text.constructFromObject({ tabLabel: 'Contract Code', value: contractCode }),
      docusign.Text.constructFromObject({ tabLabel: 'Day1', value: day }),
      docusign.Text.constructFromObject({ tabLabel: 'Day2', value: day }),
      docusign.Text.constructFromObject({ tabLabel: 'Month1', value: month }),
      docusign.Text.constructFromObject({ tabLabel: 'Month2', value: month }),
      docusign.Text.constructFromObject({ tabLabel: 'Year1', value: year }),
      docusign.Text.constructFromObject({ tabLabel: 'Year2', value: year }),
      docusign.Text.constructFromObject({ tabLabel: 'Full Name', value: contractData.fullName || '' }),
      docusign.Text.constructFromObject({ tabLabel: 'Address', value: contractData.location || 'Da Nang' }),

      docusign.Text.constructFromObject({ tabLabel: 'Email', value: contractData.email || '' }),
      docusign.Text.constructFromObject({ tabLabel: 'Phone', value: contractData.phoneNumber || '0814035790' }),
      docusign.Text.constructFromObject({ tabLabel: 'Identification', value: contractData.idNumber || '201879499' }),
      docusign.Text.constructFromObject({ tabLabel: 'Duration', value: "6" }),
    ];

    // Log the tabs being sent for debugging
    console.log('Text Tabs being sent:', JSON.stringify(textTabs, null, 2));

    // Create Technician tabs (only text tabs)
    const technicianTabs = docusign.Tabs.constructFromObject({
      textTabs: textTabs,
    });

    // Create Technician role (manual signer)
    const technicianClientUserId = `${contractData.technicianId}-${contractCode}`;
    const technician = docusign.TemplateRole.constructFromObject({
      email: contractData.email,
      name: contractData.fullName,
      roleName: 'Technician',
      clientUserId: technicianClientUserId,
      tabs: technicianTabs,
      routingOrder: '1',
    });

    envelope.templateRoles = [technician];

    // Create envelope
    const results = await envelopesApi.createEnvelope(accountId, { envelopeDefinition: envelope });
    const envelopeId = results.envelopeId;

    // Create recipient view for Technician (embedded signing)
    const viewRequest = new docusign.RecipientViewRequest();
    viewRequest.returnUrl = `${process.env.BACK_END_URL}/contract/status/${envelopeId}`;
    viewRequest.authenticationMethod = 'none';
    viewRequest.email = contractData.email;
    viewRequest.userName = contractData.fullName;
    viewRequest.clientUserId = technicianClientUserId;

    console.log('Recipient View returnUrl:', viewRequest.returnUrl);

    const viewResults = await envelopesApi.createRecipientView(accountId, envelopeId, {
      recipientViewRequest: viewRequest,
    });

    // Calculate expiration date
    const expirationDate = new Date(effectiveDate);
    expirationDate.setMonth(effectiveDate.getMonth() + 6);

    // Save contract to database
    const contract = new Contract({
      technicianId: contractData.technicianId,
      contractCode,
      effectiveDate,
      expirationDate,
      content: contractData.content,
      docusignEnvelopeId: envelopeId,
      status: 'PENDING',
    });

    await contract.save();

    return { signingUrl: viewResults.url };
  } catch (error) {
    console.error('DocuSign error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    throw new Error(`Failed to create contract: ${error.message}`);
  }
};

// Other functions (unchanged)
const getContractById = async (contractId) => {
  try {
    const contract = await Contract.findById(contractId);
    if (!contract) {
      throw new Error('Contract not found');
    }
    return contract;
  } catch (error) {
    throw new Error(`Failed to get contract: ${error.message}`);
  }
};

const getContractsByTechnicianId = async (technicianId) => {
  try {
    const contracts = await Contract.find({ technicianId });
    return contracts;
  } catch (error) {
    throw new Error(`Failed to get contracts: ${error.message}`);
  }
};

const updateContractStatus = async (contractId, status) => {
  try {
    const contract = await Contract.findByIdAndUpdate(
      contractId,
      {
        status,
        ...(status === 'SIGNED' && { signedAt: new Date() }),
      },
      { new: true }
    );
    if (!contract) {
      throw new Error('Contract not found');
    }
    return contract;
  } catch (error) {
    throw new Error(`Failed to update contract status: ${error.message}`);
  }
};

const findContractByEnvelopeId = async (envelopeId) => {
  try {
    const contract = await Contract.findOne({ docusignEnvelopeId: envelopeId });
    if (!contract) {
      throw new Error('Contract not found');
    }
    return contract;
  } catch (error) {
    throw new Error(`Failed to find contract by envelope ID: ${error.message}`);
  }
};

const updateExpiredContracts = async () => {
  try {
    const today = new Date();
    const result = await Contract.updateMany(
      {
        status: { $in: ['PENDING', 'SIGNED'] },
        expirationDate: { $lt: today }
      },
      {
        $set: { status: 'EXPIRED' }
      }
    );
    return result;
  } catch (error) {
    throw new Error(`Failed to update expired contracts: ${error.message}`);
  }
};

module.exports = {
  createContract,
  getContractById,
  getContractsByTechnicianId,
  updateContractStatus,
  findContractByEnvelopeId,
  updateExpiredContracts
};