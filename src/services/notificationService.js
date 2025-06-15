const Notification = require('../models/Notification');

exports.createNotification = async (notificationData) => {
  const notification = new Notification({
    userId: notificationData.userId,
    title: notificationData.title,
    content: notificationData.content,
    type: notificationData.type,
    referenceId: notificationData.referenceId || null,
    isRead: false,
  });

  return await notification.save();
};

exports.createAndSend = async (notificationData, io) => {
  const notification = await exports.createNotification(notificationData);
  console.log(`Emitting receiveNotification to user:${notification.userId}`);
  io.to(`user:${notification.userId}`).emit('receiveNotification', notification);
  return notification;
};

exports.sendNotification = async (notificationData, io) => {
  const notification = await exports.createAndSend(notificationData, io);
  return notification;
};

exports.markNotificationRead = async (notificationId, io) => {
  const updatedNotification = await Notification.findByIdAndUpdate(
    notificationId,
    { isRead: true },
    { new: true }
  );
  if (!updatedNotification) {
    throw new Error('Notification not found');
  }
  console.log(`Emitting notificationUpdated to user:${updatedNotification.userId}`);
  io.to(`user:${updatedNotification.userId}`).emit('notificationUpdated', updatedNotification);
  return updatedNotification;
};

exports.getUserNotifications = async (userId, options = {}) => {
  const { limit = 20, skip = 0, isRead = null } = options;
  
  const query = { userId };
  if (isRead !== null) {
    query.isRead = isRead;
  }

  return await Notification.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('userId', 'fullName email');
};

exports.markAllNotificationsAsRead = async (userId) => {
  return await Notification.updateMany(
    { userId, isRead: false },
    { isRead: true }
  );
};

exports.getUnreadNotificationsCount = async (userId) => {
  return await Notification.countDocuments({ userId, isRead: false });
};

