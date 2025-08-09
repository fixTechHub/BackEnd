const express = require('express');
const router = express.Router();
const adminPackageController = require('../controllers/adminPackageController');

// ✅ Admin thao tác với gói dịch vụ
router.get('/', adminPackageController.getAllPackages);        // Lấy tất cả gói
router.post('/', adminPackageController.createPackage);        // Tạo gói mới
router.put('/:id', adminPackageController.updatePackage);      // Cập nhật gói
router.delete('/:id', adminPackageController.deletePackage);   // Xóa gói
router.patch('/:id/toggle', adminPackageController.togglePackage); // Bật/Tắt gói

module.exports = router;
