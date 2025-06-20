const express = require('express');
const router = express.Router();
const bookingLogController = require('../controllers/bookingLogController');
const { authenticateToken } = require('../middleware/auth');

// Lấy lịch sử thay đổi của một booking item
router.get('/items/:bookingItemId', authenticateToken, bookingLogController.getBookingItemLogs);

// Lấy lịch sử thay đổi báo giá của một booking
router.get('/prices/:bookingId', authenticateToken, bookingLogController.getBookingPriceLogs);

// Lấy lịch sử thay đổi trạng thái của một booking
router.get('/status/:bookingId', authenticateToken, bookingLogController.getBookingStatusLogs);

module.exports = router; 