const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true
    },
    description: String,
    type: {
        type: String,
        enum: ['PERCENT', 'FIXED'],
        required: true
    },
    value: {
        type: Number,
        required: true
    },
    maxDiscount: Number,
    minOrderValue: {
        type: Number,
        default: 0
    },
    totalUsageLimit: {
        type: Number,
        default: 1
    },
    usedCount: {
        type: Number,
        default: 0
    },
    audience: {
        type: String,
        enum: ['ALL', 'NEW_USER', 'EXISTING_USER', 'SPECIFIC_USERS'],
        default: 'ALL'
    },
    userIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    }
}, {
    timestamps: true
});

couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ isActive: 1 });
couponSchema.index({ endDate: 1 });

module.exports = mongoose.model('Coupon', couponSchema);
