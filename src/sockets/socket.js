require('dotenv').config();
const { Server } = require('socket.io');
const messageService = require('../services/messageService');
const notificationService = require('../services/notificationService');

const initializeSocket = (server) => {
  console.log('Initializing Socket.IO...');
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONT_END_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('joinUserRoom', (userId) => {
      socket.join(`user:${userId}`);
      console.log(`User ${userId} joined room: user:${userId}`);
    });

    socket.on('sendMessage', async (messageData) => {
      try {
        await messageService.sendMessage(messageData, io);
      } catch (error) {
        console.error('Error handling sendMessage:', error.message);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('sendNotification', async (notificationData) => {
      try {
        await notificationService.sendNotification(notificationData, io);
      } catch (error) {
        console.error('Error handling sendNotification:', error.message);
        socket.emit('error', { message: 'Failed to send notification' });
      }
    });

    socket.on('markNotificationRead', async (notificationId) => {
      try {
        await notificationService.markNotificationRead(notificationId, io);
      } catch (error) {
        console.error('Error handling markNotificationRead:', error.message);
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