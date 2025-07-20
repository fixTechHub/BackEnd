// const express = require('express');
// const router = express.Router();
// const bookingItemController = require('../controllers/bookingItemController');
// const { authenticateToken } = require('../middlewares/authMiddleware');

// // Kỹ thuật viên đề xuất thêm chi phí
// router.post('/booking/:bookingId/propose', authenticateToken, bookingItemController.proposeAdditionalItems);

// // Lấy danh sách chi phí phát sinh (cả khách hàng và kỹ thuật viên)
// router.get('/booking/:bookingId/items', authenticateToken, bookingItemController.getAdditionalItemsByBooking);

// // Khách hàng xác nhận chi phí phát sinh
// router.post('/booking/:bookingId/approve', authenticateToken, bookingItemController.approveAdditionalItems);

// // Khách hàng từ chối chi phí phát sinh
// router.post('/booking/:bookingId/reject', authenticateToken, bookingItemController.rejectAdditionalItems);

// module.exports = router;
