const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// This route will be called by the frontend to initiate the payment process
router.post('/finalize-booking/:bookingPriceId', paymentController.finalizeBooking);

// This route is the return URL for PayOS
router.get('/success', paymentController.handlePayOsSuccess);

// This route is the return URL for PayOS cancel
router.get('/cancel', paymentController.handlePayOsCancel);

module.exports = router;
