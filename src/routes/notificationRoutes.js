const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middlewares/authMiddleware');

router.get('/',
  authenticateToken,
  notificationController.getUserNotifications);
router.patch('/:id/read',
  authenticateToken,
  notificationController.markAsRead);

router.delete('/clear', authenticateToken, notificationController.clearAllNotifications);
router.get('/all', authenticateToken, notificationController.getAllUserNotifications);

router.post('/',authenticateToken, notificationController.sendNotification)
module.exports = router;
