const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// Route to create a new contract and initiate signing
router.post('/', authenticateToken, contractController.createContract);

// Route to get all contracts for a specific technician
router.get('/technician/:technicianId', authenticateToken, contractController.getContractsByTechnicianId);

// Route to get a single contract by its ID
router.get('/:id', authenticateToken, contractController.getContractById);

// Route for DocuSign to call back to after signing is complete
router.get('/docusign/callback/:envelopeId', contractController.handleDocuSignCallback);


module.exports = router;
