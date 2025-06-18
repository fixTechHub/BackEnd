const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// Create a new contract
router.post('/', authenticateToken, contractController.createContract);

// Get contract by ID
router.get('/:id', authenticateToken, contractController.getContractById);

// Get contracts by technician ID
router.get('/technician/:technicianId', authenticateToken, contractController.getContractsByTechnicianId);



// DocuSign callback endpoint
router.get('/status/:id', contractController.handleDocuSignCallback);

module.exports = router;