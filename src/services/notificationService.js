const Notification = require('../models/Notification');
const { getIo } = require('../sockets/socketManager');

exports.createNotification = async (notificationData, session) => {
  const notification = new Notification({
    userId: notificationData.userId,
    title: notificationData.title,
    content: notificationData.content,
    type: notificationData.type,
    referenceId: notificationData.referenceId || null,
    isRead: false,
  });

  return await notification.save({ session });
};

exports.createAndSend = async (notificationData, session) => {
  const notification = await exports.createNotification(
    notificationData,
    session
  );
  return notification;
};

exports.sendSocketNotification = (notification) => {
  const io = getIo();
  if (io && notification) {
    const notificationObject = notification.toObject ? notification.toObject() : notification;
    io.to(`user:${notificationObject.userId}`).emit('receiveNotification', notificationObject);
    console.log(`Socket notification sent to user: ${notificationObject.userId}`);
  }
};

exports.sendNotification = async (notificationData) => {
  const notification = await exports.createAndSend(notificationData);
  exports.sendSocketNotification(notification);
  return notification;
};

exports.markNotificationRead = async (notificationId) => {
  const io = getIo();
  const updatedNotification = await Notification.findByIdAndUpdate(
    notificationId,
    { isRead: true },
    { new: true }
  );
  if (!updatedNotification) {
    throw new Error('Notification not found');
  }
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

