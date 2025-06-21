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

const sendMessage = async (req, res) => {
  try {
    const messageData = {
      ...req.body,
      fromUser: req.user.userId,
    };
    const newMessage = await messageService.sendMessage(messageData);
    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ message: 'Failed to send message', error: error.message });
  }
};

module.exports = {
  getMessages,
  sendMessage,
};
