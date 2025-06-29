const express = require('express');
const router = express.Router();
const bookingWarrantyController = require('../controllers/bookingWarrantyController')
const { authenticateToken } = require('../middlewares/authMiddleware');
router.post('/', authenticateToken, bookingWarrantyController.requestBookingWarranty);

module.exports = router;
