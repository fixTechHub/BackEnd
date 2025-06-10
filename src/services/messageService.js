const Message = require('../models/Message')
const { uploadFileToS3 } = require('./s3Service');



exports.createMessage = async (messageData) => {
  let contentToSave = messageData.content;

  // If fileBase64 is present, decode and upload
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

exports.getMessagesByBookingId = async (bookingId) => {
  return await Message.find({ bookingId })
};
