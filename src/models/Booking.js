const mongoose = require('mongoose');
const { Schema } = mongoose;

const bookingSchema = new Schema({
    bookingCode: String,
    customerId: { type: Schema.Types.ObjectId, ref: 'User' },
    technicianId: { type: Schema.Types.ObjectId, ref: 'Technician', default: null },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }
    },
    description: String,
    images: [String],
    schedule: Date,
    customerConfirmedDone: Boolean,
    technicianConfirmedDone: Boolean,
    status: {
        type: String,
        enum: ['PENDING', 'QUOTED', 'IN_PROGRESS', 'WAITING_CONFIRM', 'WAITING_DONE', 'DONE', 'AUTO_DONE', 'CANCELLED'],
        default: 'PENDING'
    },
    warrantyCount: Number,
    lastWarrantyAt: Date,
    lastWarrantyStatus: String,
    deletedAt: Date
}, { timestamps: true });

bookingSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Booking', bookingSchema);
