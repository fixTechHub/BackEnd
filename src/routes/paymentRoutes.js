const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const {authenticateToken} = require('../middlewares/authMiddleware')
// This route will be called by the frontend to initiate the payment process
router.post('/finalize-booking/:bookingId',authenticateToken, paymentController.finalizeBooking);

