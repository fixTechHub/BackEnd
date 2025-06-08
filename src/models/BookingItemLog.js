const mongoose = require('mongoose');

const bookingItemLogSchema = new mongoose.Schema({
    bookingItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BookingItem',
        required: true
    },
    version: {
        type: Number,
        required: true
    },
    action: {
        type: String,
        enum: ['CREATED', 'UPDATED', 'DELETED'],
        required: true
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

bookingItemLogSchema.index({ bookingItemId: 1 });
bookingItemLogSchema.index({ bookingItemId: 1, version: -1 });
bookingItemLogSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('BookingItemLog', bookingItemLogSchema);
