const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const couponController = require('../controllers/couponController');

router.get('/user', authenticateToken, couponController.getUserCoupons);

module.exports = router;
