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
  await newMessage.populate('fromUser')
  // Create notification for recipient
  const notificationData = {
    userId: newMessage.toUser,
    title: `Tin nhắn mới từ ${newMessage.fromUser.fullName}`,
    content: newMessage.content.length > 50 
      ? `${newMessage.content.substring(0, 47)}...` 
      : newMessage.content, 
    type: 'MESSAGE',
    referenceId: newMessage._id,
    referenceModel: 'Message', 
  };
  
  // Create notification first, then emit socket notification
  const notification = await notificationService.createNotification(notificationData);
  
  // Emit socket notification after successful creation
  io.to(`user:${notification.userId}`).emit('receiveNotification', notification);

  // Emit events to update chat UI
  io.to(`user:${newMessage.fromUser._id}`).emit('receiveMessage', newMessage);
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