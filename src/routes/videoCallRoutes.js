const express = require('express');
const router = express.Router();
const videoCallController = require('../controllers/videoCallController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// All routes require authentication
router.use(authenticateToken);

// Initiate a video call
router.post('/initiate', videoCallController.initiateCall);

// Accept a video call
router.post('/accept', videoCallController.acceptCall);

// Reject a video call
router.post('/reject', videoCallController.rejectCall);

// End a video call
router.post('/end', videoCallController.endCall);

// Get call history for a user
router.get('/history/:userId', videoCallController.getCallHistory);

// Get active call for a user
router.get('/active/:userId', videoCallController.getActiveCall);

module.exports = router;
