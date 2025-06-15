const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    bookingCode: {
        type: String,
        required: true
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    technicianId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Technician'
    },
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: true
    },
    location: {
        address: {
            type: String
        },
        geojson: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: {
                type: [Number],
                required: true
            }
        }
    },
    description: String,
    images: [String],
    schedule: {
        type: Date,
        required: true
    },
    customerConfirmedDone: {
        type: Boolean,
        default: false
    },
    technicianConfirmedDone: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['PENDING', 'QUOTED', 'IN_PROGRESS', 'WAITING_CONFIRM', 'DONE', 'CANCELLED'],
        default: 'PENDING'
    },
    statusReason: String,
    isChatAllowed: {
        type: Boolean,
        default: false
    },
    isVideoCallAllowed: {
        type: Boolean,
        default: false
    },
    warrantyExpiresAt: Date,
    completedAt: Date,
    cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    paymentStatus: {
        type: String,
        enum: ['PENDING', 'PAID', 'CANCELLED', 'FAILED', 'REFUNDED'],
        default: 'PENDING'
    },
    cancellationReason: String
}, {
    timestamps: true
});

bookingSchema.index({ 'location.geojson': '2dsphere' });

bookingSchema.index({ bookingCode: 1 }, { unique: true });
bookingSchema.index({ status: 1 });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ completedAt: -1 });

bookingSchema.index({ customerId: 1, status: 1 });
bookingSchema.index({ technicianId: 1, status: 1 });
bookingSchema.index({ customerId: 1, createdAt: -1 });
bookingSchema.index({ technicianId: 1, createdAt: -1 });
bookingSchema.index({ status: 1, schedule: 1 });
bookingSchema.index({ status: 1, createdAt: -1 });
bookingSchema.index({ paymentStatus: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
