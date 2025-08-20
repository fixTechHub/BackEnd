const express = require('express');
const router = express.Router();
const technicianServiceController = require('../controllers/technicianServiceController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// Middleware để kiểm tra quyền technician
const checkTechnicianRole = (req, res, next) => {
    // Handle both populated role object and string role
    const roleName = req.user.role?.name || req.user.role;
    
    if (roleName !== 'TECHNICIAN') {
        return res.status(403).json({
            success: false,
            message: 'Chỉ kỹ thuật viên mới có quyền truy cập'
        });
    }
    
    next();
};

// Lấy danh sách dịch vụ và giá của kỹ thuật viên
router.get('/my-services', authenticateToken, checkTechnicianRole, technicianServiceController.getTechnicianServices);

// Kiểm tra có thể cập nhật giá không
router.get('/check-update-eligibility', authenticateToken, checkTechnicianRole, technicianServiceController.checkUpdateEligibility);

// Cập nhật giá dịch vụ và bảo hành
router.put('/update-prices', authenticateToken, checkTechnicianRole, technicianServiceController.updateServicePrices);

module.exports = router;
