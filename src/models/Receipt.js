const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema({
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician' },
    receiptCode: String,
    misaInvoiceId: String,
    totalAmount: Number,
    serviceAmount: Number,
    commissionAmount: Number,
    discountAmount: Number,
    paidAmount: Number,
    paymentMethod: { type: String, enum: ['BANK', 'CASH', 'MISA'] },
    paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'CANCELLED', 'FAILED', 'REFUNDED'] },
    issuedDate: Date,
    description: String
}, { timestamps: true });

module.exports = mongoose.model('Receipt', receiptSchema);
