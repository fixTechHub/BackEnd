const contractService = require('../services/contractService');
const { validateContract } = require('../validations/contractValidator');

const createContract = async (req, res) => {
    try {
        const validationError = validateContract(req.body);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const { signingUrl } = await contractService.createContract(req.body);
        res.status(200).json({ signingUrl });
    } catch (error) {
        console.log(error);
        
        res.status(500).json({ message: error.message });
    }
};

const getContractById = async (req, res) => {
    try {
        const contract = await contractService.getContractById(req.params.id);
        res.json(contract);
    } catch (error) {
        if (error.message === 'Contract not found') {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: error.message });
    }
};

const getContractsByTechnicianId = async (req, res) => {
    try {
        const contracts = await contractService.getContractsByTechnicianId(req.params.technicianId);
        res.json(contracts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


const handleDocuSignCallback = async (req, res) => {
    try {
        const {envelopeId} = req.params

        const { event  } = req.query;
        // Find contract by envelope ID using service
        const contract = await contractService.findContractByEnvelopeId(envelopeId);

        // Update contract status based on DocuSign event
        let status;
        switch (event) {
            case 'signing_complete':
                status = 'SIGNED';
                break;
            case 'declined':
                status = 'REJECTED';
                break;
            default:
                return res.status(200).json({ message: 'Không thực hiện được quá trình' });
        }

        // Update the contract status using the service
        await contractService.updateContractStatus(contract._id, status);

        // Redirect to frontend with status information
        const redirectUrl = `${process.env.FRONT_END_URL}/contract/complete`;
        res.redirect(redirectUrl);
    } catch (error) {
        if (error.message === 'Contract not found') {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createContract,
    getContractById,
    getContractsByTechnicianId,
 
    handleDocuSignCallback
};
