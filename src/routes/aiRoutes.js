const express = require('express');
const router = express.Router();
const { getAiChatResponse } = require('../controllers/aiController');

// POST /api/chat
router.post('/chat', getAiChatResponse);

module.exports = router;
