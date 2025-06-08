const mongoose = require('mongoose');

const commissionConfigSchema = new mongoose.Schema({
    commissionPercent: {
        type: Number,
        required: true
    },
    holdingPercent: {
        type: Number,
        required: true
    },
    commissionMinAmount: {
        type: Number,
        default: 0
    },
    commissionType: {
        type: String,
        enum: ['PERCENT', 'MIN_AMOUNT'],
        default: 'PERCENT'
    },
    startDate: {
        type: Date,
        required: true
    },
    isApplied: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

commissionConfigSchema.index({ isApplied: 1 });
commissionConfigSchema.index({ startDate: -1 });

module.exports = mongoose.model('CommissionConfig', commissionConfigSchema);
