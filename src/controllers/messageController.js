const messageService = require('../services/messageService');

const getMessages = async (req, res) => {
  try {
    const { bookingId } = req.query;
    const messages = await messageService.getMessagesByBookingId(bookingId);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

module.exports = {
  getMessages,
};