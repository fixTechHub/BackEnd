const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const multer = require('multer');
const upload = multer();

// Profile routes
router.get('/profile', authenticateToken, userController.getProfile);
router.put('/profile', authenticateToken, userController.updateProfile);
router.put('/profile/avatar', authenticateToken, upload.single('avatar'), userController.updateAvatar);

module.exports = router;
