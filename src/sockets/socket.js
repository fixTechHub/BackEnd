module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('chat message', (msg) => {
      io.emit('chat message', msg);
    });
  });
};
