const mongoose = require('mongoose');

const bookingPriceLogSchema = new mongoose.Schema({
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
    priceVersion: {
        type: Number,
        required: true
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'UPDATED'],
        required: true
    },
    note: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

bookingPriceLogSchema.index({ bookingId: 1 });
bookingPriceLogSchema.index({ bookingId: 1, priceVersion: -1 });
bookingPriceLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('BookingPriceLog', bookingPriceLogSchema);
