const express = require('express');
const router = express.Router();
const favoriteTechnicianController = require('../controllers/favoriteTechnicianController');
const { authenticateToken } = require('../middlewares/authMiddleware');

const checkCustomerRole = (req, res, next) => {
    if (req.user?.role !== 'CUSTOMER') {
        return res.status(403).json({ message: 'Forbidden - Requires CUSTOMER role' });
    }
    next();
};

router.use(authenticateToken, checkCustomerRole);
router.get('/', favoriteTechnicianController.getFavoriteTechnicians);
router.post('/', favoriteTechnicianController.addFavoriteTechnician);
router.delete('/:technicianId', favoriteTechnicianController.removeFavoriteTechnician);

module.exports = router; 