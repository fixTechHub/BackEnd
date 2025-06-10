const mongoose = require('mongoose');

const bookingPriceSchema = new mongoose.Schema({
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true
    },
    technicianId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Technician',
        required: true
    },
    commissionConfigId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CommissionConfig'
    },
    laborPrice: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'ACCEPTED', 'REJECTED'],
        default: 'PENDING'
    },
    quotedAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: Date,
    finalPrice: Number,
    warrantiesDuration: {
        type: Number,
        default: 0
    },
    extraDescription: String,
    discountCode: String,
    discountValue: {
        type: Number,
        default: 0
    },
    technicianEarning: Number,
    commissionAmount: Number,
    holdingAmount: Number
}, {
    timestamps: true
});

// Indexes
bookingPriceSchema.index({ bookingId: 1 });
bookingPriceSchema.index({ technicianId: 1 });
bookingPriceSchema.index({ status: 1 });
bookingPriceSchema.index({ quotedAt: -1 });
bookingPriceSchema.index({ expiresAt: 1 });
bookingPriceSchema.index({ createdAt: -1 });

// Compound indexes
bookingPriceSchema.index({ bookingId: 1, status: 1 });
bookingPriceSchema.index({ technicianId: 1, status: 1 });
bookingPriceSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model('BookingPrice', bookingPriceSchema);
