const notificationService = require('../services/notificationService');

exports.getUserNotifications = async (req, res) => {
  try {
    const notifications = await notificationService.getUserNotifications(
      req.user.userId
    );
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await notificationService.markNotificationRead(id);
    res.status(200).json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
