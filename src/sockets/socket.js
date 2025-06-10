require('dotenv').config();
const { Server } = require('socket.io');
const messageService = require('../services/messageService');
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

    socket.on('sendMessage', async (message) => {
      try {
        
        const newMessage = await messageService.createMessage(message);
        io.emit('receiveMessage', newMessage);
      } catch (error) {
        console.error('Error saving message:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  return io;
};

module.exports = initializeSocket;


