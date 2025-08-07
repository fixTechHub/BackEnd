const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController')
const { handleMulter, processAndUploadToS3 } = require('../middlewares/uploadMiddleware'); 
const { authenticateToken } = require('../middlewares/authMiddleware');

router.get('/', feedbackController.getAllFeedback);
router.get('/:technicianId', feedbackController.getFeedbackList);
// thêm verifyCustomer
router.post(
  '/:bookingId',
  authenticateToken,
  (req, res, next) => {
    next();
  },
  handleMulter.any(),
  processAndUploadToS3('feedbacks'),
  feedbackController.submitFeedback
);
// router.post(
//   '/:bookingId',
//   handleMulter.array('files'), // handle up to 5 images 
//   processAndUploadToS3('feedbacks'), // upload to "feedbacks/" folder in S3
//   authenticateToken,
//   feedbackController.submitFeedback
// );
router.put('/:feedbackId', authenticateToken, feedbackController.editFeedback);
router.put('/:feedbackId/reply', feedbackController.replyToFeedback);
router.put('/:feedbackId/moderate', feedbackController.moderateFeedback);

module.exports = router;
