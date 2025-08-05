const express = require('express');
const router = express.Router();
const technicianSubscriptionController = require('../controllers/technicianSubscriptionController');

// ✅ Technician thao tác với gói đã đăng ký
router.get('/packages', technicianSubscriptionController.getAvailablePackages);   // Lấy danh sách gói khả dụng
router.post('/subscribe', technicianSubscriptionController.subscribePackage);     // Đăng ký gói mới
router.post('/renew', technicianSubscriptionController.renewSubscription);        // Gia hạn gói
router.get('/:technicianId/current', technicianSubscriptionController.getCurrentSubscription); // Lấy gói hiện tại

module.exports = router;
