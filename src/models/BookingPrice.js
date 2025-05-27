const mongoose = require('mongoose');
const { Schema } = mongoose;

const itemSchema = new Schema({
    name: String,
    price: Number,
    quantity: Number,
    note: String
}, { _id: false });

const bookingPriceSchema = new Schema({
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    technicianId: { type: Schema.Types.ObjectId, ref: 'Technician' },
    commissionConfigId: { type: Schema.Types.ObjectId, ref: 'CommissionConfig' },
    basePrice: Number,
    finalPrice: Number,
    items: [itemSchema],
    warrantiesDuration: Number,
    extraDescription: String,
    extraApproved: Boolean,
    discountCode: String,
    discountValue: Number,
    paymentMethod: { type: String, enum: ['BANK', 'CASH'] },
    paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'CANCELLED', 'FAILED', 'REFUNDED', 'PARTIALLY_PAID'] },
    transactionId: String,
    technicianEarning: Number,
    commissionAmount: Number
}, { timestamps: true });

module.exports = mongoose.model('BookingPrice', bookingPriceSchema);
