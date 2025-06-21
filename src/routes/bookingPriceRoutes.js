const express = require('express');
const bookingPriceController = require('../controllers/bookingPriceController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const router = express.Router();

router.get('/booking/:bookingId', bookingPriceController.getAllQuotations);
router.get('/:quotationId', bookingPriceController.getQuotationDetail);
router.post('/:quotationId/accept', authenticateToken, bookingPriceController.acceptQuotation);

module.exports = router;
