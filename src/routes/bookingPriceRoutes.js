const express = require('express');
const bookingPriceController = require('../controllers/bookingPriceController');
const {authenticateToken} = require('../middlewares/authMiddleware')
const router = express.Router();

router.get('/booking/:bookingId', bookingPriceController.getAllQuotations);
router.get('/:quotationId', bookingPriceController.getQuotationDetail);
router.post('/:quotationId/accept', bookingPriceController.acceptQuotation);
router.get('/acceptedBookingPrice/:bookingId/:technicianId',
    authenticateToken,
    bookingPriceController.getAcceptedQuotation)
module.exports = router;
