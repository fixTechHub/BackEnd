const express = require('express');
const bookingController = require('../controllers/bookingController');
const validate = require('../middlewares/validationMiddleware');
const bookingValidation = require('../validations/bookingValidation');
const { handleMulter, processAndUploadToS3 } = require('../middlewares/uploadMiddleware');
const { authenticateToken } = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/create-new-booking-request', authenticateToken, handleMulter.array('images', 5), processAndUploadToS3('bookings'), bookingController.createBookingRequest);
router.get('/:bookingId/details', bookingController.getDetailBookingById);
router.get('/:id', bookingController.getBookingById);
router.post('/:bookingId/cancel', authenticateToken, bookingController.cancelBooking);
router.post('/:bookingId/done', authenticateToken, bookingController.confirmJobDone);
router.post('/:bookingId/quote', authenticateToken, bookingController.technicianSendQuote);
router.post('/:bookingId/quote/accept', authenticateToken, bookingController.customerAcceptQuote);
router.post('/:bookingId/quote/reject', authenticateToken, bookingController.customerRejectQuote);

module.exports = router;
