const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController')
const { handleMulter, processAndUploadToS3 } = require('../middlewares/uploadMiddleware'); 
const { authenticateToken } = require('../middlewares/authMiddleware');
const { upload } = require('../middlewares/upload');

router.get('/', feedbackController.getAllFeedback);
router.get('/:technicianId', feedbackController.getFeedbackList);
router.get('/by-technician/:technicianId', feedbackController.listByTechnician);
router.get('/:technicianId/feedbacks', feedbackController.listFeedbacksForTechnician);
router.get('/:technicianId/feedbacks/stats', feedbackController.feedbackStatsForTechnician);
router.get('/from/:userId', feedbackController.getFeedbacksByFromUser);
router.get('/booking/:bookingId', feedbackController.fetchByBookingId);
// thêm verifyCustomer

router.post(
  '/:bookingId',
  upload.array('files', 5), // handle up to 5 images 
  processAndUploadToS3('feedbacks'), // upload to "feedbacks/" folder in S3
  authenticateToken,
  feedbackController.submitFeedback
);
router.put('/:feedbackId', authenticateToken, feedbackController.editFeedback);
router.put('/:feedbackId/reply', authenticateToken, feedbackController.replyToFeedback);
router.put('/:feedbackId/moderate', feedbackController.moderateFeedback);

module.exports = router;
