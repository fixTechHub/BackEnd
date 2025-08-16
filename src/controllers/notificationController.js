const { default: mongoose } = require('mongoose');
const notificationService = require('../services/notificationService');
const { getIo } = require('../sockets/socketManager');
const User = require('../models/User');
const { sendWarningEmail } = require('../utils/mail');

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
    const  notificationData = req.body
    
    const io = getIo()
    const notification = await notificationService.createNotification(notificationData)
    const user = await User.findById(notification.userId)
    await sendWarningEmail(user.email,notification.content)
    io.to(`user:${notification.userId}`).emit('receiveNotification', notification);

    res.status(200).json(notification);
  } catch (error) {
    console.log(error.message);
   
    res.status(500).json({ message: error.message });
    
  }
}


exports.clearAllAdminNotifications = async (req, res) => {
  try {
    const {adminId} = req.params
    await notificationService.clearAllNotifications(adminId);
    res.status(200).json({ message: 'All notifications cleared' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAdminNotifications = async (req, res) => {
  try {
    const {adminId} = req.params

    const notifications = await notificationService.getUserNotifications(
      adminId
    );
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
