const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken } = require('../middlewares/authMiddleware');

router.get('/test', (req, res) => res.json('This is API Admin test page'));

// User account management routes
router.post('/users/:userId/deactivate', authenticateToken, adminController.deactivateUserAccount);
router.post('/users/:userId/activate', authenticateToken, adminController.activateUserAccount);

module.exports = router;
