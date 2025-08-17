const express = require('express');
const technicianScheduleController = require('../controllers/technicianScheduleController');
const { authenticateToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// Lấy danh sách lịch trình trùng
router.get('/conflicts', authenticateToken, technicianScheduleController.getConflictingSchedules);

module.exports = router;
