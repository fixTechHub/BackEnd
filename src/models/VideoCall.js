const mongoose = require('mongoose');
const { Schema } = mongoose;

const videoCallSchema = new Schema({
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    sessionId: String,
    startedAt: Date,
    endedAt: Date
});

module.exports = mongoose.model('VideoCall', videoCallSchema);
