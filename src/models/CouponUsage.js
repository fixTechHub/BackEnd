const mongoose = require('mongoose');

const couponUsageSchema = new mongoose.Schema({
    couponId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Coupon',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true
    },
    usedAt: {
        type: Date,
        default: Date.now
    }
});

couponUsageSchema.index({ couponId: 1 });
couponUsageSchema.index({ userId: 1 });
couponUsageSchema.index({ bookingId: 1 });

module.exports = mongoose.model('CouponUsage', couponUsageSchema);