const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticateToken } = require('../middlewares/authMiddleware');

router.get('/', authenticateToken, messageController.getMessages);
router.post('/', authenticateToken, messageController.sendMessage);

module.exports = router;
