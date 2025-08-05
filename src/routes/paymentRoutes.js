const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const {authenticateToken} = require('../middlewares/authMiddleware')
// This route will be called by the frontend to initiate the payment process
router.post('/finalize-booking/:bookingId',authenticateToken, paymentController.finalizeBooking);

// This route is the return URL for PayOS
router.get('/success', paymentController.handlePayOsSuccess);

// This route is the return URL for PayOS cancel
router.get('/cancel', paymentController.handlePayOsCancel);

router.post('/subscription',authenticateToken,paymentController.subscriptionBalance)

router.get('/subscription/success',paymentController.handleSubscriptionPayOsSuccess)

router.get('/subscription/cancel', paymentController.handleSubscriptionPayOsCancel)

router.post('/subscription/extend', paymentController.extendSubscription);

router.get('/subscription/extend/success', paymentController.handleExtendPayOsSuccess);

router.post('/deposit',authenticateToken,paymentController.depositBalance)

router.get('/deposit/success',paymentController.handleDepositPayOsSuccess)

router.get('/deposit/cancel', paymentController.handleDepositPayOsCancel)

module.exports = router;
