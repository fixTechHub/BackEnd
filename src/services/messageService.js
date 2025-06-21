const { getIo } = require('../sockets/socketManager');
const Message = require('../models/Message');
const { uploadFileToS3 } = require('./s3Service');
const notificationService = require('./notificationService');

const createMessage = async (messageData) => {
  let contentToSave = messageData.content;

  // Handle file upload if present
  if (messageData.fileBase64 && messageData.originalName && messageData.mimetype) {
    const base64Data = messageData.fileBase64.replace(/^data:.*;base64,/, '');
    const fileBuffer = Buffer.from(base64Data, 'base64');

    const imageUrl = await uploadFileToS3(
      fileBuffer,
      messageData.originalName,
      messageData.mimetype,
      'messages'
    );
    contentToSave = imageUrl;
  }

  const message = new Message({
    bookingId: messageData.bookingId,
    fromUser: messageData.fromUser,
    toUser: messageData.toUser,
    content: contentToSave,
    type: messageData.type || 'GENERAL',
  });

  return await message.save();
};

const sendMessage = async (messageData) => {
  const io = getIo();
  // Create and save message
  const newMessage = await createMessage(messageData);

  // Create notification for recipient
  const notificationData = {
    userId: newMessage.toUser,
    title: 'New Message',
    content: newMessage.content.length > 50 
      ? `${newMessage.content.substring(0, 47)}...` 
      : newMessage.content,
    type: 'MESSAGE',
    referenceId: newMessage._id,
  };
  
  // Use createAndSend to ensure real-time notification
  await notificationService.createAndSend(notificationData);

  // Emit events to update chat UI
  io.to(`user:${newMessage.fromUser}`).emit('receiveMessage', newMessage);
  io.to(`user:${newMessage.toUser}`).emit('receiveMessage', newMessage);

  return newMessage;
};

const getMessagesByBookingId = async (bookingId) => {
  return await Message.find({ bookingId: bookingId });
};  

module.exports = exports = {
  createMessage,
  sendMessage,
  getMessagesByBookingId,
};