const express = require('express');
const authController = require('../controllers/authController')
const {authenticateToken} = require('../middlewares/authMiddleware')
const router = express.Router();

router.post('/google-login', authController.googleAuthController)
router.post('/register', authController.register)
router.post('/complete-registration', authController.completeRegistration)
router.post('/check-exist', authController.checkExist)
router.post('/verify-otp', authController.verifyOTP)
router.post('/verify-email', authController.verifyEmail)
router.post('/login', authController.login)
router.post('/logout', authController.logout)
router.get('/me', authenticateToken, authController.getAuthenticatedUser)
router.post('/forgot-password', authController.forgotPassword)
router.post('/reset-password', authController.resetPassword)
router.post('/update-role', authenticateToken, authController.updateUserRole)
router.post('/refresh-token', authController.refreshToken)

module.exports = router;
