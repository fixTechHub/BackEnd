const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true
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
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    content: String,
    images: [String],
    isVisible: {
        type: Boolean,
        default: true
    },
    hiddenReason: String,
    reply: {
        content: String,
        createdAt: Date,
        updatedAt: Date
    }
}, {
    timestamps: true
});

feedbackSchema.index({ bookingId: 1 });
feedbackSchema.index({ toUser: 1 });
feedbackSchema.index({ rating: -1 });
feedbackSchema.index({ isVisible: 1 });
feedbackSchema.index({ toUser: 1, isVisible: 1, createdAt: -1 });
feedbackSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
