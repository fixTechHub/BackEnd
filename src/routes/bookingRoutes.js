const express = require('express');
const bookingController = require('../controllers/bookingController');
const validate = require('../middlewares/validationMiddleware');
const bookingValidation = require('../validations/bookingValidation');
const { handleMulter, processAndUploadToS3 } = require('../middlewares/uploadMiddleware');
const router = express.Router();

router.post('/create-new-booking-request', handleMulter.array('images', 5), processAndUploadToS3('bookings'), bookingController.createBookingRequest);
router.get('/:id', bookingController.getBookingById);
router.post('/:bookingId/cancel', bookingController.cancelBooking);
router.post('/:bookingId/done', bookingController.confirmJobDone);


module.exports = router;
