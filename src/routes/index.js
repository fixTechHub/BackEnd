const express = require('express');
const Role = require('../models/Role');

const router = express.Router();

// Mount router
router.use('/auth', require('./authRoutes'));
router.use('/admin', require('./adminRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/bookings', require('./bookingRoutes'));
router.use('/booking-prices', require('./bookingPriceRoutes'));
router.use('/warranties', require('./bookingWarrantyRoutes'));
router.use('/categories', require('./categoryRoutes'));
router.use('/commissions-config', require('./commissionRoutes'));
router.use('/contracts', require('./contractRoutes'));
router.use('/coupons', require('./couponRoutes'));
router.use('/feedbacks', require('./feedbackRoutes'));
router.use('/messages', require('./messageRoutes'));
router.use('/ai', require('./aiRoutes'))
router.use('/notifications', require('./notificationRoutes'));
router.use('/payments', require('./paymentRoutes'));
router.use('/reports', require('./reportRoutes'));
router.use('/services', require('./serviceRoutes'));
router.use('/technicians', require('./technicianRoutes'));
router.use('/video-call', require('./videoCallRoutes'));
router.use('/receipts', require('./receiptRoutes'));
router.use('/booking-items', require('./bookingItemRoutes'));
router.use('/favorites', require('./favoriteTechnicianRoutes'));

router.get('/test', async (req, res) => {
    try {
        const roles = await Role.find();
        const b = await require('../models/BookingItem').find();
        const b1 = await require('../models/BookingItemLog').find();
        const b11 = await require('../models/BookingPrice').find();
        const b12 = await require('../models/BookingPriceLog').find();
        const b13 = await require('../models/BookingStatusLog').find();
        const b14 = await require('../models/BookingWarranty').find();
        const b15 = await require('../models/Category').find();
        const b16 = await require('../models/Certificate').find();
        const b17 = await require('../models/CommissionConfig').find();
        const b18 = await require('../models/ContentReport').find();
        const b19 = await require('../models/Contract').find();
        const b112 = await require('../models/Coupon').find();
        const b111 = await require('../models/CouponUsage').find();
        const b113 = await require('../models/DepositLog').find();
        const b114 = await require('../models/FavoriteTechnician').find();
        const b115 = await require('../models/Feedback').find();
        const b121 = await require('../models/Message').find();
        const b1122 = await require('../models/ForumComment').find();
        const b1231 = await require('../models/ForumPost').find();
        const b231 = await require('../models/Notification').find();
        const b2r31 = await require('../models/Receipt').find();
        const bd1 = await require('../models/Report').find();
        const b1e = await require('../models/Service').find();
        const b1er = await require('../models/SystemReport').find();
        const b1rr = await require('../models/TechnicianSchedule').find();
        const b1gt = await require('../models/VideoCall').find();
        const b1q = await require('../models/Technician').find();
        const b1qq = await require('../models/User').find();

        res.json({
            roles,
            bookingItems: b,
            bookingItemLogs: b1,
            bookingPrices: b11,
            bookingPriceLogs: b12,
            bookingStatusLogs: b13,
            bookingWarranties: b14,
            categories: b15,
            certificates: b16,
            commissionConfigs: b17,
            contentReports: b18,
            contracts: b19,
            coupons: b112,
            couponUsages: b111,
            depositLogs: b113,
            favoriteTechnicians: b114,
            feedbacks: b115,
            messages: b121,
            forumComments: b1122,
            forumPosts: b1231,
            notifications: b231,
            receipts: b2r31,
            reports: bd1,
            services: b1e,
            systemReports: b1er,
            technicianSchedules: b1rr,
            videoCalls: b1gt,
            technicians: b1q,
            users: b1qq,
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
