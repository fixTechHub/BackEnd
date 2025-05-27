const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: { type: String, unique: true },
    description: String,
    type: { type: String, enum: ['PERCENT', 'FIXED'] },
    value: Number,
    maxDiscount: Number,
    minOrderValue: Number,
    totalUsageLimit: Number,
    usedCount: { type: Number, default: 0 },
    audience: { type: String, enum: ['ALL', 'NEW_USER', 'EXISTING_USER', 'SPECIFIC_USERS'] },
    userIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isActive: { type: Boolean, default: true },
    startDate: Date,
    endDate: Date
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);
