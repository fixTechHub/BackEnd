const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
// const { protect } = require('../middlewares/authMiddleware');

router.get('/', 
    // protect,
     messageController.getMessages);
router.post('/', 
    // protect,
     messageController.sendMessage);

module.exports = router;
