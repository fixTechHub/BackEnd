const mongoose = require('mongoose');
const { Schema } = mongoose;

const bookingWarrantySchema = new Schema({
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    customerId: { type: Schema.Types.ObjectId, ref: 'User' },
    technicianId: { type: Schema.Types.ObjectId, ref: 'Technician' },
    requestDate: Date,
    reportedIssue: String,
    isUnderWarranty: Boolean,
    expireAt: Date,
    confirmedDate: Date,
    status: { type: String, enum: ['PENDING', 'CONFIRMED', 'RESOLVED', 'DENIED'], default: 'PENDING' },
    resolutionNote: String,
    customerConfirmedDone: Boolean,
    customerConfirmedAt: Date,
    customerRating: Number,
    content: String
}, { timestamps: true });

module.exports = mongoose.model('BookingWarranty', bookingWarrantySchema);
