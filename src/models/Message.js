const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking'
    },
    fromUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    toUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['SERVICE', 'SUPPORT', 'GENERAL'],
        default: 'GENERAL'
    }
}, {
    timestamps: true
});

messageSchema.index({ bookingId: 1 });
messageSchema.index({ fromUser: 1 });
messageSchema.index({ toUser: 1 });
messageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);