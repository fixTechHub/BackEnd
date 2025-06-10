require('dotenv').config();
const { Server } = require('socket.io');
const messageService = require('../services/messageService');
const notificationService = require('../services/notificationService');

const initializeSocket = (server) => {
  console.log('Initializing Socket.IO...');
  const io = new Server(server, {
    cors: {
      origin: `${process.env.FRONT_END_URL}`,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('joinUserRoom', (userId) => {
      socket.join(`user:${userId}`);
      console.log(`User ${userId} joined room: user:${userId}`);
    });

    socket.on('sendMessage', async (message) => {
      try {
        const newMessage = await messageService.createMessage(message);
        
        const notification = await notificationService.createNotification({
          userId: newMessage.toUser,
          title: 'New Message',
          content: newMessage.content.length > 50 
            ? newMessage.content.substring(0, 47) + '...' 
            : newMessage.content,
          type: 'MESSAGE',
          referenceId: newMessage._id
        });
        io.to(`user:${newMessage.fromUser}`).emit('receiveMessage', newMessage);
        io.to(`user:${newMessage.toUser}`).emit('receiveMessage', newMessage);
        
        io.to(`user:${newMessage.toUser}`).emit('receiveNotification', notification);
      } catch (error) {
        console.error('Error saving message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('sendNotification', async (notificationData) => {
      try {
        const notification = await notificationService.createNotification(notificationData);
        io.to(`user:${notification.userId}`).emit('receiveNotification', notification);
      } catch (error) {
        console.error('Error processing notification:', error);
        socket.emit('error', { message: 'Failed to send notification' });
      }
    });

    socket.on('markNotificationRead', async (notificationId) => {
      try {
        const updatedNotification = await notificationService.markNotificationAsRead(notificationId);
        io.to(`user:${updatedNotification.userId}`).emit('notificationUpdated', updatedNotification);
      } catch (error) {
        console.error('Error marking notification as read:', error);
        socket.emit('error', { message: 'Failed to mark notification as read' });
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  return io;
};

module.exports = initializeSocket;