const mongoose = require('mongoose');
const { Schema } = mongoose;

const messageSchema = new Schema({
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    fromUser: { type: Schema.Types.ObjectId, ref: 'User' },
    toUser: { type: Schema.Types.ObjectId, ref: 'User' },
    content: String,
    type: { type: String, enum: ['SERVICE', 'SUPPORT', 'GENERAL'], default: 'GENERAL' }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
