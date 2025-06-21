const express = require('express');
const Role = require('../models/Role');
const router = express.Router();

// Mount router
router.use('/auth', require('./authRoutes'));
router.use('/admin', require('./adminRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/bookings', require('./bookingRoutes'));
router.use('/warranties', require('./bookingWarrantyRoutes'));
router.use('/categories', require('./categoryRoutes'));
router.use('/commissions-config', require('./commissionRoutes'));
router.use('/coupons', require('./couponRoutes'));
router.use('/feedbacks', require('./feedbackRoutes'));
router.use('/messages', require('./messageRoutes'));
router.use('/notifications', require('./notificationRoutes'));
router.use('/payments', require('./paymentRoutes'));
router.use('/reports', require('./reportRoutes'));
router.use('/services', require('./serviceRoutes'));
router.use('/technicians', require('./technicianRoutes'));
router.use('/video-call', require('./videoCallRoutes'));
router.get('/test', (req, res) => res.json('This Is API test page for dev'));
router.get('/roles', async (req, res) => {
    try {
        const roles = await Role.find();
        res.json(roles);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
