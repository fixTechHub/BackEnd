const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const systemReportController = require('../controllers/systemReportController');

// User submit system report
router.post('/', authenticateToken, systemReportController.createSystemReport);

// Admin list system reports with filters
router.get('/', authenticateToken, systemReportController.getSystemReportList);

// Get detail
router.get('/:id', authenticateToken, systemReportController.getSystemReportById);

// Update status (admin)
router.patch('/:id/status', authenticateToken, systemReportController.updateSystemReportStatus);

module.exports = router;
