const express = require('express');
const router = express.Router();
const { getAiChatResponse } = require('../controllers/aiController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// POST /api/chat
router.post('/chat',
    // authenticateToken,
     getAiChatResponse);

module.exports = router;
