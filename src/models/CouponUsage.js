const mongoose = require('mongoose');

const couponUsageLogSchema = new mongoose.Schema({
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    usesAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CouponUsageLog', couponUsageLogSchema);
