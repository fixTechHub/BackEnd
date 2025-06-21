const docusign = require('docusign-esign');
const { initializeApiClient } = require('../config/docusignSetUp');
const Contract = require('../models/Contract');
const { generateContractCode } = require('../utils/generateCode');
const Technician = require('../models/Technician');
const User = require('../models/User');
const notificationService = require('./notificationService');

// Internal helper function to create the DocuSign envelope
const _createDocusignEnvelope = async (contractData, contractCode) => {
  const { dsApiClient, accountId } = await initializeApiClient();
  const envelopesApi = new docusign.EnvelopesApi(dsApiClient);

  const effectiveDate = new Date();
  const day = effectiveDate.getDate().toString();
  const month = (effectiveDate.getMonth() + 1).toString();
  const year = effectiveDate.getFullYear().toString();

  const envelope = new docusign.EnvelopeDefinition();
  envelope.templateId = process.env.DOCUSIGN_TEMPLATE_ID;
  envelope.status = 'sent';

  const textTabs = [
    docusign.Text.constructFromObject({ tabLabel: 'Contract Code', value: contractCode }),
    docusign.Text.constructFromObject({ tabLabel: 'Day1', value: day }),
    docusign.Text.constructFromObject({ tabLabel: 'Day2', value: day }),
    docusign.Text.constructFromObject({ tabLabel: 'Month1', value: month }),
    docusign.Text.constructFromObject({ tabLabel: 'Month2', value: month }),
    docusign.Text.constructFromObject({ tabLabel: 'Year1', value: year }),
    docusign.Text.constructFromObject({ tabLabel: 'Year2', value: year }),
    docusign.Text.constructFromObject({ tabLabel: 'Full Name', value: contractData.fullName }),
    docusign.Text.constructFromObject({ tabLabel: 'Address', value: contractData.address }),
    docusign.Text.constructFromObject({ tabLabel: 'Email', value: contractData.email }),
    docusign.Text.constructFromObject({ tabLabel: 'Phone', value: contractData.phone }),
    docusign.Text.constructFromObject({ tabLabel: 'Identification', value: contractData.idNumber }),
    docusign.Text.constructFromObject({ tabLabel: 'Duration', value: "6" }),
  ];

  const technicianTabs = docusign.Tabs.constructFromObject({ textTabs: textTabs });
  const technicianClientUserId = `${contractData.technicianId}-${contractCode}`;
  const technicianRole = docusign.TemplateRole.constructFromObject({
    email: contractData.email,
    name: contractData.fullName,
    roleName: 'Technician',
    clientUserId: technicianClientUserId,
    tabs: technicianTabs,
    routingOrder: '1',
  });

  envelope.templateRoles = [technicianRole];

  const results = await envelopesApi.createEnvelope(accountId, { envelopeDefinition: envelope });
  return results.envelopeId;
};

const generateContractOnRegistration = async (technicianId, session = null) => {

  try {
    const technician = await Technician.findById(technicianId)
      .populate('userId')
      .session(session);

    if (!technician) {
      throw new Error('Technician not found');
    }
    const user = technician.userId;

    const contractCode = await generateContractCode();

    const contractData = {
      fullName: user.fullName,
      email: user.email,
      address: `${user.address?.street}, ${user.address?.district}, ${user.address?.city}`,
      phone: user.phone,
      idNumber: technician.identification,
      technicianId: technician._id
    };

    const envelopeId = await _createDocusignEnvelope(contractData, contractCode);

    // Generate the signing URL
    const { dsApiClient, accountId } = await initializeApiClient();
    const envelopesApi = new docusign.EnvelopesApi(dsApiClient);
    const viewRequest = new docusign.RecipientViewRequest();
    viewRequest.returnUrl = `${process.env.BACK_END_URL}/contracts/status/${envelopeId}`; // Redirect after signing
    viewRequest.authenticationMethod = 'none';
    viewRequest.email = contractData.email;
    viewRequest.userName = contractData.fullName;
    viewRequest.clientUserId = `${contractData.technicianId}-${contractCode}`;
    const viewResults = await envelopesApi.createRecipientView(accountId, envelopeId, { recipientViewRequest: viewRequest });

    const effectiveDate = new Date();
    const expirationDate = new Date(effectiveDate);
    expirationDate.setMonth(effectiveDate.getMonth() + 6);

    const contract = new Contract({
      technicianId: technician._id,
      contractCode,
      effectiveDate,
      expirationDate,
      docusignEnvelopeId: envelopeId,
      signingUrl: viewResults.url, // Save the signing URL
      status: 'PENDING',
      content: `Service agreement contract for ${user.fullName} created on ${effectiveDate.toLocaleDateString()}.`
    });

    await contract.save({ session });
    console.log(`Contract created automatically for technician: ${technicianId}`);

    const notificationData = {
      userId: technician.userId,
      title: 'Your Account has been Approved!',
      content: 'Tài khoản kỹ thuật viên của bạn đã được phê duyệt. Vui lòng đăng nhập và ký hợp đồng để bắt đầu nhận việc.',
      type: 'NEW_REQUEST',
      referenceId: contract._id
    };

    // Pass session to notification service if it supports transactions
    await notificationService.createAndSend(notificationData, session);

  } catch (error) {
    console.error('Failed to create contract on registration:', error);
    throw error; // Re-throw to allow transaction rollback
  }
};

const createContract = async (contractData, session = null) => {
  try {
    if (!process.env.FRONT_END_URL || !process.env.FRONT_END_URL.startsWith('http')) {
      throw new Error('FRONTEND_URL must be an absolute URL (e.g., https://yourapp.com)');
    }

    const contractCode = await generateContractCode();
    const envelopeId = await _createDocusignEnvelope(contractData, contractCode);

    const { dsApiClient, accountId } = await initializeApiClient();
    const envelopesApi = new docusign.EnvelopesApi(dsApiClient);

    const viewRequest = new docusign.RecipientViewRequest();
    viewRequest.returnUrl = `${process.env.BACK_END_URL}/contracts/status/${envelopeId}`;
    viewRequest.authenticationMethod = 'none';
    viewRequest.email = contractData.email;
    viewRequest.userName = contractData.fullName;
    viewRequest.clientUserId = `${contractData.technicianId}-${contractCode}`;

    const viewResults = await envelopesApi.createRecipientView(accountId, envelopeId, {
      recipientViewRequest: viewRequest,
    });

    const effectiveDate = new Date();
    const expirationDate = new Date(effectiveDate);
    expirationDate.setMonth(effectiveDate.getMonth() + 6);

    const contract = new Contract({
      technicianId: contractData.technicianId,
      contractCode,
      effectiveDate,
      expirationDate,
      content: contractData.content,
      docusignEnvelopeId: envelopeId,
      status: 'PENDING',
    });

    await contract.save({ session });

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

const getContractById = async (contractId, session = null) => {
  try {
    const query = Contract.findById(contractId);
    if (session) query.session(session);

    const contract = await query.exec();
    if (!contract) {
      throw new Error('Contract not found');
    }
    return contract;
  } catch (error) {
    throw new Error(`Failed to get contract: ${error.message}`);
  }
};

const getContractsByTechnicianId = async (technicianId, session = null) => {
  try {
    const query = Contract.find({ technicianId });
    if (session) query.session(session);

    const contracts = await query.exec();
    return contracts;
  } catch (error) {
    throw new Error(`Failed to get contracts: ${error.message}`);
  }
};

const updateContractStatus = async (contractId, status, session = null) => {
  try {
    const query = Contract.findByIdAndUpdate(
      contractId,
      {
        status,
        ...(status === 'SIGNED' && { signedAt: new Date() }),
      },
      { new: true }
    );
    if (session) query.session(session);

    const contract = await query.exec();
    if (!contract) {
      throw new Error('Contract not found');
    }
    return contract;
  } catch (error) {
    throw new Error(`Failed to update contract status: ${error.message}`);
  }
};

const findContractByEnvelopeId = async (envelopeId, session = null) => {
  try {
    const query = Contract.findOne({ docusignEnvelopeId: envelopeId });
    if (session) query.session(session);

    const contract = await query.exec();
    if (!contract) {
      throw new Error('Contract not found');
    }
    return contract;
  } catch (error) {
    throw new Error(`Failed to find contract by envelope ID: ${error.message}`);
  }
};

const updateExpiredContracts = async (session = null) => {
  try {
    const today = new Date();
    const query = Contract.updateMany(
      {
        status: { $in: ['PENDING', 'SIGNED'] },
        expirationDate: { $lt: today }
      },
      {
        $set: { status: 'EXPIRED' }
      }
    );
    if (session) query.session(session);

    const result = await query.exec();
    return result;
  } catch (error) {
    throw new Error(`Failed to update expired contracts: ${error.message}`);
  }
};

module.exports = {
  createContract,
  generateContractOnRegistration,
  getContractById,
  getContractsByTechnicianId,
  updateContractStatus,
  findContractByEnvelopeId,
  updateExpiredContracts
};