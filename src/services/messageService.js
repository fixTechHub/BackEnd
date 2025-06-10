const Message = require('../models/Message')

exports.createMessage = async (messageData) => {
    const message = new Message({
      ...messageData,
    });
    return await message.save();
  };

exports.getMessagesByBookingId = async (bookingId) => {
    return await Message.find({ bookingId })
  };
  