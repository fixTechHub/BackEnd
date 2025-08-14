const mongoose = require('mongoose');

const depositLogSchema = new mongoose.Schema({
    technicianId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Technician',
        required: true
    },
    type: {
        type: String,
        enum: ['DEPOSIT', 'WITHDRAW', 'SUBSCRIPTION', 'SUBSCRIPTION_EXTEND'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED'],
        default: 'PENDING'
    },
    paymentMethod: {
        type: String,
        enum: ['BANK']
    },
    paymentGatewayTransactionId: String,
    transactionCode: String,
    balanceBefore: {
        type: Number,
        required: true
    },
    balanceAfter: Number,
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: Date,
    note: String
}, {
    timestamps: true
});

depositLogSchema.index({ technicianId: 1 });
depositLogSchema.index({ status: 1 });
depositLogSchema.index({ type: 1 });
depositLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('DepositLog', depositLogSchema);