const Booking = require('../models/Booking')

exports.getBookingById = async (bookingId) => {
    return await Booking.findById(bookingId).select('customerId technicianId');
  };
  