const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician' },
    tag: { type: String, enum: ['VIOLATION', 'SCAM', 'OTHER'], required: true },
    reason: String,
    resolved: { type: Boolean, default: false },
    resolvedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);
