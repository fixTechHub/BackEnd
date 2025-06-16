const messageService = require('../services/messageService');

const getMessages = async (req, res) => {
  try {
    const { bookingId } = req.query;
    const messages = await messageService.getMessagesByBookingId(bookingId);
    res.json(messages);
  } catch (error) {
    console.error('Error getting MessagesMessages:', error);

    res.status(500).json({ message: 'Lỗi khi lấy tin nhắn:', error: error.message });
  }
};

module.exports = {
  getMessages,
};