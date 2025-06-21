const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken } = require('../middlewares/authMiddleware');
// Assuming an 'isAdmin' middleware exists to protect admin routes
// const { isAdmin } = require('../middlewares/roleMiddleware');

// Route to approve a technician
// This route should be protected to be accessible only by admins.
router.put(
    '/technicians/:id/approve', 
    authenticateToken, 
    // isAdmin, // <-- You would uncomment this when you have an admin role check
    adminController.approveTechnician
);

router.get('/test', (req, res) => res.json('This is API Admin test page'));

module.exports = router;
