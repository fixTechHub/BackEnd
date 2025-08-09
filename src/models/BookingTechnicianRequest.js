const mongoose = require('mongoose');

const bookingTechnicianRequestSchema = new mongoose.Schema({
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
    requestedAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
        default: 'PENDING'
    }
}, { timestamps: true });

// Index để tối ưu query
bookingTechnicianRequestSchema.index({ bookingId: 1, technicianId: 1 });
bookingTechnicianRequestSchema.index({ status: 1, expiresAt: 1 });
bookingTechnicianRequestSchema.index({ bookingId: 1, status: 1 });
bookingTechnicianRequestSchema.index({ expiresAt: 1 }); // Cho cronjob

module.exports = mongoose.model('BookingTechnicianRequest', bookingTechnicianRequestSchema); 