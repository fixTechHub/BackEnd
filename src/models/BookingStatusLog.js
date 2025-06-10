const mongoose = require('mongoose');

const bookingStatusLogSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  fromStatus: {
    type: String,
    required: true
  },
  toStatus: {
    type: String,
    required: true
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['CUSTOMER', 'TECHNICIAN', 'SYSTEM', 'ADMIN'],
    required: true
  },
  note: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
bookingStatusLogSchema.index({ bookingId: 1 });
bookingStatusLogSchema.index({ changedBy: 1 });
bookingStatusLogSchema.index({ createdAt: -1 });
bookingStatusLogSchema.index({ toStatus: 1 });

// Compound indexes
bookingStatusLogSchema.index({ bookingId: 1, createdAt: -1 });
bookingStatusLogSchema.index({ changedBy: 1, role: 1 });

module.exports = mongoose.model('BookingStatusLog', bookingStatusLogSchema);
