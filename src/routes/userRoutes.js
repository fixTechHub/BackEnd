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

module.exports = router;
