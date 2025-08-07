const mongoose = require('mongoose');

const BookingTechnicianSearchSchema = new mongoose.Schema({
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true,
        unique: true
    },
    foundTechnicianIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    foundTechniciansDetail: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    },
    lastSearchAt: {
        type: Date,
        default: Date.now
    },
    completed: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('BookingTechnicianSearch', BookingTechnicianSearchSchema);
