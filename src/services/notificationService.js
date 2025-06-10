const Notification = require('../models/Notification');

exports.createNotification = async (notificationData) => {
  const notification = new Notification({
    userId: notificationData.userId,
    title: notificationData.title,
    content: notificationData.content,
    type: notificationData.type,
    referenceId: notificationData.referenceId || null,
    isRead: false
  });

  return await notification.save();
};

// Get notifications for a specific user
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

// Mark notification as read
exports.markNotificationAsRead = async (notificationId) => {
  return await Notification.findByIdAndUpdate(
    notificationId,
    { isRead: true },
    { new: true }
  );
};

// Mark all notifications as read for a user
exports.markAllNotificationsAsRead = async (userId) => {
  return await Notification.updateMany(
    { userId, isRead: false },
    { isRead: true }
  );
};

// Get unread notifications count for a user
exports.getUnreadNotificationsCount = async (userId) => {
  return await Notification.countDocuments({ userId, isRead: false });
};