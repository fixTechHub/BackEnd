const mongoose = require('mongoose');

const bookingItemSchema = new mongoose.Schema({
    bookingPriceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BookingPrice',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        default: 1
    },
    note: String,
    status: {
        type: String,
        enum: ['EXTRA', 'ORIGINAL'],
        default: 'ORIGINAL'
    },
    isApprovedByCustomer: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

bookingItemSchema.index({ bookingPriceId: 1 });
bookingItemSchema.index({ createdAt: -1 });
bookingItemSchema.index({ bookingPriceId: 1, isApprovedByCustomer: 1 });

module.exports = mongoose.model('BookingItem', bookingItemSchema);
