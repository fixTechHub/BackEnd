const bookingService = require('../services/bookingService')


exports.getBookingById = async (req, res) => {
    try {
      const { bookingId } = req.params;
      const booking = await bookingService.getBookingById(bookingId);
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      res.json(booking);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch booking' });
    }
  };