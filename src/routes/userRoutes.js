const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const multer = require('multer');
const upload = multer();

// Profile routes
router.get('/profile', authenticateToken, userController.getProfile);
router.patch('/profile', authenticateToken, userController.updateProfile);
router.patch('/profile/avatar', authenticateToken, upload.single('avatar'), userController.updateAvatar);
router.put('/change-password', authenticateToken, userController.changePassword);

// Deactivate account routes
router.post('/deactivate-account', authenticateToken, userController.deactivateAccount);
router.post('/request-deactivate-verification', authenticateToken, userController.requestDeactivateVerification);
router.post('/verify-deactivate-account', authenticateToken, userController.verifyDeactivateAccount);

// Delete account routes
router.post('/delete-account/request-verification', authenticateToken, userController.requestDeleteVerification);
router.post('/delete-account/verify-otp', authenticateToken, userController.verifyDeleteOTP);
router.post('/delete-account/confirm', authenticateToken, userController.deleteAccount);

module.exports = router;
