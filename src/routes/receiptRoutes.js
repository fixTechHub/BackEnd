const express = require('express');
const router = express.Router();
const receiptController = require('../controllers/receiptController');
const {authenticateToken} = require('../middlewares/authMiddleware')

// This route will be called by the frontend to initiate the payment process


// This route is the return URL for PayOS
router.get('/',authenticateToken, receiptController.viewUserReceipt);

// This route is the return URL for PayOS cancel

module.exports = router;