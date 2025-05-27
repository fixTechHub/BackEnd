const mongoose = require('mongoose');
const { Schema } = mongoose;

const replySchema = new Schema({
    content: String,
    createdAt: Date
}, { _id: false });

const feedbackSchema = new Schema({
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    fromUser: { type: Schema.Types.ObjectId, ref: 'User' },
    toUser: { type: Schema.Types.ObjectId, ref: 'User' },
    rating: Number,
    content: String,
    images: [String],
    isVisible: Boolean,
    hiddenReason: String,
    reply: replySchema
}, { timestamps: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
