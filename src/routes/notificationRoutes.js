const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
// const { protect } = require('../middlewares/authMiddleware');

router.get('/',
    //  protect, 
     notificationController.getUserNotifications);
router.patch('/:id/read',
    //  protect,
      notificationController.markAsRead);


module.exports = router;
