const express = require('express');
const authController = require('../controllers/authController')
const {authenticateToken} = require('../middlewares/authMiddleware')
const router = express.Router();

router.post('/google',authController.googleAuthController)
router.post('/logout',authController.logout)
router.post('/login',authController.login)
router.post('/register',authController.register)
router.get('/verify_email',authController.verifyEmail)
router.post('/forgot-password',authController.forgotPassword)
router.post('/reset-password',authController.resetPassword)
router.get('/me', authenticateToken, authController.getAuthenticatedUser);
module.exports = router;
