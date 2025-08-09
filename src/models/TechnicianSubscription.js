const mongoose = require('mongoose');
const technicianSubscriptionSchema = new mongoose.Schema({
    technician: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Technician',
        required: true
    },
    package: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CommissionPackage',
        required: true
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'EXPIRED', 'CANCELLED'],
        default: 'ACTIVE'
    },
    paymentHistory: [{
        amount: Number,
        paidAt: Date,
        method: {
            type: String,
            enum: ['BALANCE', 'BANK_TRANSFER'], // ✅ bổ sung enum rõ ràng
            default: 'BALANCE'
        }
    }]
}, { timestamps: true });

// Một technician chỉ có thể có 1 subscription ACTIVE tại 1 thời điểm
technicianSubscriptionSchema.index({ technician: 1, status: 1 });

module.exports = mongoose.model('TechnicianSubscription', technicianSubscriptionSchema);
