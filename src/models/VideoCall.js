const mongoose = require('mongoose');
const { Schema } = mongoose;

const videoCallSchema = new Schema({
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    warrantyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warranty', default: null },
    sessionId: String,
    startedAt: Date,
    endedAt: Date,
    duration: { type: Number, default: 0 }, // Duration in seconds
    status: {
        type: String,
        enum: ['INITIATED', 'ONGOING', 'ENDED', 'DECLINED'],
        default: 'INITIATED'
    }
});

module.exports = mongoose.model('VideoCall', videoCallSchema);
