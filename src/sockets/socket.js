const { Server } = require('socket.io');

const userSocketMap = new Map(); // Maps userId to socketId

const initializeSocket = (server) => {
  console.log(`--- Socket.IO configured to allow origin: ${process.env.FRONT_END_URL} ---`);
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONT_END_URL,
      methods: ["GET", "POST"],
      credentials: true
    }
  });


  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;
    if (userId) {
      // If this user is already connected, disconnect the old socket
      if (userSocketMap.has(userId)) {
        const oldSocketId = userSocketMap.get(userId);
        const oldSocket = io.sockets.sockets.get(oldSocketId);
        if (oldSocket) {
          console.log(`User ${userId} reconnected. Disconnecting old socket: ${oldSocketId}`);
          oldSocket.disconnect();
        }
      }

      // Store the new socket for this user
      userSocketMap.set(userId, socket.id);
      socket.userId = userId; // Store userId on the socket instance for easy lookup on disconnect

      const roomName = `user:${userId}`;
      socket.join(roomName);
      console.log(`A user connected: ${socket.id}, successfully joined room: ${roomName}`);
    } else {
      console.log(`A user connected: ${socket.id}, but no userId was provided.`);
    }

    // Video call signaling handlers
    socket.on('join_call_room', (data) => {
      const { callId } = data;
      socket.join(`call:${callId}`);
      console.log(`User ${socket.userId} joined call room: ${callId}`);
    });

    socket.on('leave_call_room', (data) => {
      const { callId } = data;
      socket.leave(`call:${callId}`);
      console.log(`User ${socket.userId} left call room: ${callId}`);
    });

    // WebRTC signaling
    socket.on('offer', (data) => {
      const { callId, offer, targetUserId } = data;
      const targetSocketId = userSocketMap.get(targetUserId);
      
      if (targetSocketId) {
        io.to(targetSocketId).emit('offer', {
          callId,
          offer,
          fromUserId: socket.userId
        });
        console.log(`Offer sent from ${socket.userId} to ${targetUserId} for call ${callId}`);
      }
    });

    socket.on('answer', (data) => {
      const { callId, answer, targetUserId } = data;
      const targetSocketId = userSocketMap.get(targetUserId);
      
      if (targetSocketId) {
        io.to(targetSocketId).emit('answer', {
          callId,
          answer,
          fromUserId: socket.userId
        });
        console.log(`Answer sent from ${socket.userId} to ${targetUserId} for call ${callId}`);
      }
    });

    socket.on('ice_candidate', (data) => {
      const { callId, candidate, targetUserId } = data;
      const targetSocketId = userSocketMap.get(targetUserId);
      
      if (targetSocketId) {
        io.to(targetSocketId).emit('ice_candidate', {
          callId,
          candidate,
          fromUserId: socket.userId
        });
        console.log(`ICE candidate sent from ${socket.userId} to ${targetUserId} for call ${callId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      // If the disconnected socket is the one we have on record, remove it from the map
      if (socket.userId && userSocketMap.get(socket.userId) === socket.id) {
        userSocketMap.delete(socket.userId);
        console.log(`Removed user ${socket.userId} from socket map.`);
      }
    });
  });

  return io;

}

module.exports = { initializeSocket, userSocketMap };