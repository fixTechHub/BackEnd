const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken } = require('../middlewares/authMiddleware');


// Route to approve a technician
// This route should be protected to be accessible only by admins.
router.put(
    '/technicians/:id/approve', 
    authenticateToken, 
    adminController.approveTechnician
);

router.get('/test', (req, res) => res.json('This is API Admin test page'));

// User account management routes
router.post('/users/:userId/deactivate', authenticateToken, adminController.deactivateUserAccount);
router.post('/users/:userId/activate', authenticateToken, adminController.activateUserAccount);

router.post('/withdraws/:logId/approve', adminController.approveWithdraw);

module.exports = router;
