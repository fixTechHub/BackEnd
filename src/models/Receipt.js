const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema({
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    technicianId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Technician',
        required: true
    },
    receiptCode: {
        type: String,
        required: true
    },
    paymentGatewayTransactionId: String,
    totalAmount: {
        type: Number,
        required: true
    },
    serviceAmount: {
        type: Number,
        required: true
    },
    commissionAmount: {
        type: Number,
        default: 0
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    holdingAmount: {
        type: Number,
        default: 0
    },
    paidAmount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['BANK', 'CASH'],
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['PENDING', 'PAID', 'CANCELLED', 'FAILED', 'REFUNDED'],
        default: 'PENDING'
    },
    issuedDate: {
        type: Date,
        required: true
    }
}, {
    timestamps: true
});

receiptSchema.index({ receiptCode: 1 }, { unique: true });
receiptSchema.index({ bookingId: 1 });
receiptSchema.index({ customerId: 1 });
receiptSchema.index({ paymentStatus: 1 });

module.exports = mongoose.model('Receipt', receiptSchema);