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

exports.clearAllNotifications = async (req, res) => {
  try {
    await notificationService.clearAllNotifications(req.user.userId);
    res.status(200).json({ message: 'All notifications cleared' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllUserNotifications = async (req, res) => {
  try {
    const { limit, skip } = req.query;
    const notifications = await notificationService.getAllUserNotifications(
      req.user.userId,
      { limit: parseInt(limit) || 20, skip: parseInt(skip) || 0 }
    );
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.sendNotification = async (req,res) => {
  try {
    const [ notifyData] = req.body
    const notification = await notificationService.createAndSend(notifyData)
    res.status(200).json(notification);
  } catch (error) {
    res.status(500).json({ message: error.message });
    
  }
}