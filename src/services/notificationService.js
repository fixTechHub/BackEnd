const Notification = require('../models/Notification');
const { getIo } = require('../sockets/socketManager');

exports.createNotification = async (notificationData, session) => {
  // Validate referenceModel when referenceId is provided
  if (notificationData.referenceId && !notificationData.referenceModel) {
    throw new Error('referenceModel is required when referenceId is provided');
  }
  if (notificationData.referenceModel && !['User', 'Payment', 'Message', 'Booking', 'Contract', 'BookingPrice'].includes(notificationData.referenceModel)) {
    throw new Error('Invalid referenceModel value');
  }

  const notification = new Notification({
    userId: notificationData.userId,
    title: notificationData.title,
    content: notificationData.content,
    type: notificationData.type,
    url: notificationData.url ?? null,
    referenceId: notificationData.referenceId || null,
    referenceModel: notificationData.referenceModel || null,
    isRead: false,
  });

  const savedNotification = await notification.save({ session });
  return savedNotification;
};

exports.createAndSend = async (notificationData, session) => {
  const io = getIo();
  const notification = await exports.createNotification(
    notificationData,
    session
  );
  io.to(`user:${notification.userId}`).emit('receiveNotification', notification);
  return notification;
};

exports.sendNotification = async (notificationData) => {
  const notification = await exports.createAndSend(notificationData);
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
  const { limit = 20, skip = 0, isRead = null, } = options;
  
  const query = { userId,status: 'DISPLAY' };
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

// New function to emit socket notification after transaction commit
exports.emitNotificationAfterCommit = async (notificationData) => {
  const io = getIo();
  const notification = await exports.createNotification(notificationData);
  io.to(`user:${notification.userId}`).emit('receiveNotification', notification);
  return notification;
};

// Function to emit socket notification for existing notification data (without creating duplicate)
exports.emitSocketNotification = async (notificationData) => {
  
  
  const io = getIo();
  // Create a notification object for socket emission (without saving to DB again)
  const notification = {
    userId: notificationData.userId,
    title: notificationData.title,
    content: notificationData.content,
    type: notificationData.type,
    referenceId: notificationData.referenceId,
    isRead: false,
    createdAt: new Date()
  };
  

  io.to(`user:${notification.userId}`).emit('receiveNotification', notification);

  return notification;
};
exports.clearAllNotifications = async (userId) => {
  return await Notification.updateMany(
    { userId, status: 'DISPLAY' },
    { status: 'DELETED' }
  );
};

exports.getAllUserNotifications = async (userId, options = {}) => {
  const { limit = 20, skip = 0 } = options;
  
  const query = { userId, status: 'DISPLAY' };

  return await Notification.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('userId', 'fullName email');
};
