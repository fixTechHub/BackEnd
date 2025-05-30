const express = require('express');
const authController = require('../controllers/authController')
const {authenticateToken} = require('../middlewares/authMiddleware')
const router = express.Router();

router.post('/google',authController.googleAuthController)
router.post('/logout',authController.logout)
router.get('/me', authenticateToken, authController.getMe);
router.post('/login',authController.login)
router.get('/verify_email',)
module.exports = router;
