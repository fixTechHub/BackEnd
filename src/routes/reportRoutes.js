const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const reportController = require('../controllers/reportController');

// Create a report
router.post('/', authenticateToken, reportController.createReport);

// Get user reports count
router.get('/user/count', authenticateToken, reportController.getReportsByUserId);

// Get report detail
router.get('/:id', authenticateToken, reportController.getReportById);

module.exports = router;
