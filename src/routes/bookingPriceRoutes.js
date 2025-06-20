const express = require('express');
const bookingPriceController = require('../controllers/bookingPriceController');
const router = express.Router();

router.get('/booking/:bookingId', bookingPriceController.getAllQuotations);
router.get('/:quotationId', bookingPriceController.getQuotationDetail);
router.post('/:quotationId/accept', bookingPriceController.acceptQuotation);

module.exports = router;
