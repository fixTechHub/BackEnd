const mongoose = require('mongoose');

const bookingWarrantySchema = new mongoose.Schema({
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
    requestDate: {
        type: Date,
        required: true
    },
    proposedSchedule: {
        type: Date,
        required: false
    },
    confirmedSchedule: {
        startTime: Date,
        expectedEndTime: Date
    },
    reportedIssue: {
        type: String,
        required: true
    },
    isUnderWarranty: {
        type: Boolean,
        default: true
    },
    expireAt: Date,
    images: [String],
    status: {
        type: String,
        enum: ['PENDING', 'CONFIRMED', 'RESOLVED', 'DENIED', 'DONE'],
        default: 'PENDING'
    },
    solutionNote: String,
    rejectionReason: String,
    isReviewedByAdmin: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

bookingWarrantySchema.index({ bookingId: 1 });
bookingWarrantySchema.index({ customerId: 1 });
bookingWarrantySchema.index({ technicianId: 1 });
bookingWarrantySchema.index({ status: 1 });
bookingWarrantySchema.index({ isReviewedByAdmin: 1 });
bookingWarrantySchema.index({ customerId: 1, status: 1 });
bookingWarrantySchema.index({ technicianId: 1, status: 1 });

module.exports = mongoose.model('BookingWarranty', bookingWarrantySchema);
