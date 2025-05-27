const mongoose = require('mongoose');

const commissionConfigSchema = new mongoose.Schema({
    commissionPercent: Number,
    commissionMinAmount: Number,
    commissionType: { type: String, enum: ['PERCENT', 'MIN_AMOUNT'] }
}, { timestamps: true });

module.exports = mongoose.model('CommissionConfig', commissionConfigSchema);
