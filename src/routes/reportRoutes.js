const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const reportController = require('../controllers/reportController');

// Create a report
router.post('/', authenticateToken, reportController.createReport);

// Get report detail
router.get('/:id', authenticateToken, reportController.getReportById);

module.exports = router;
