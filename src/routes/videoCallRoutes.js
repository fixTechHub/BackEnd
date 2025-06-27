const express = require('express');
const router = express.Router();
const videoCallController = require('../controllers/videoCallController');
const { authenticateToken } = require('../middlewares/authMiddleware');

router.get('/online-users', authenticateToken, videoCallController.getOnlineUsers);
router.get('/status/:sessionId', authenticateToken, videoCallController.getVideoCallStatus);
router.patch('/status/:sessionId', authenticateToken, videoCallController.updateVideoCallStatus);

// New routes for video call events
router.post('/initiate', authenticateToken, videoCallController.initiateCall);
router.post('/answer', authenticateToken, videoCallController.answerCall);
router.post('/end', authenticateToken, videoCallController.endCall);
router.post('/decline', authenticateToken, videoCallController.declineCall);

// New route for call history
router.get('/history/:bookingId', authenticateToken, videoCallController.getCallHistory);

module.exports = router;
