const mongoose = require('mongoose');
const reportSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['REPORT', 'VIOLATION'],
    default: 'REPORT',
    required: true,
    index: true,
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: false,
    index: true,
  },
  warrantyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BookingWarranty',
    required: false,
    index: true,
  },
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  reportedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  tag: {
    type: String,
    enum: ['NO_SHOW', 'LATE', 'RUDE', 'ISSUE', 'OTHER'],
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  evidences: {
    type: [String],
    default: [],
  },
  status: {
    type: String,
    enum: ['PENDING', 'AWAITING_RESPONSE', 'REJECTED', 'RESOLVED'],
    default: 'PENDING',
    index: true,
  },
  responseDeadline: Date,
  responseLocked: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});
reportSchema.index({ bookingId: 1, warrantyId: 1, status: 1 });
reportSchema.index(
  { bookingId: 1, warrantyId: 1, reporterId: 1, reportedUserId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['PENDING', 'AWAITING_RESPONSE'] } },
    name: 'uniq_active_report_booking_or_warranty'
  }
);
module.exports = mongoose.model('Report', reportSchema);