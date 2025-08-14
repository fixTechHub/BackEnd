const { Server } = require('socket.io');

const userSocketMap = new Map(); // Maps userId to socketId
const activeCallsMap = new Map(); // Maps userId to their current call partner
const initializeSocket = (server) => {
  console.log(`--- Socket.IO configured to allow origin: ${process.env.FRONT_END_URL} ---`);
  const io = new Server(server, {
    cors: {
      origin: [
        process.env.FRONT_END_URL,
        'https://fix-tech-six.vercel.app',
        'https://fix-tech-git-develop-tris-projects-f8fdb778.vercel.app',
        'http://localhost:5174',
        'https://fixtech.id.vn', // Domain chính của bạn
        'https://www.fixtech.id.vn' // Cả www và non-www
      ],
      methods: ["GET", "POST"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"]
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000
  });

  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;
    if (userId) {
      if (userSocketMap.has(userId)) {
        const oldSocketId = userSocketMap.get(userId);
        const oldSocket = io.sockets.sockets.get(oldSocketId);
        if (oldSocket) {
          console.log(`User ${userId} reconnected. Disconnecting old socket: ${oldSocketId}`);
          oldSocket.disconnect();
        }
      }

      userSocketMap.set(userId, socket.id);
      socket.userId = userId;

      const roomName = `user:${userId}`;
      socket.join(roomName);
      console.log(`A user connected: ${socket.id}, successfully joined room: ${roomName}`);
    } else {
      console.log(`A user connected: ${socket.id}, but no userId was provided.`);
    }

    socket.emit("me", socket.id);
    socket.on('joinChatRoom', ({ type, bookingId, warrantyId }) => {
      if (type === 'booking' && bookingId) {
        const bookingRoom = `booking:${bookingId}:user:${socket.userId}`;
        socket.join(bookingRoom);
        console.log(`User ${socket.userId} joined room ${bookingRoom}`);
      } else if (type === 'warranty' && warrantyId) {
        const warrantyRoom = `warranty:${warrantyId}:user:${socket.userId}`;
        socket.join(warrantyRoom);
        console.log(`User ${socket.userId} joined room ${warrantyRoom}`);
      } else {
        console.log(`Invalid room join request from ${socket.userId}`);
      }
    });
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);
      if (socket.userId && activeCallsMap.has(socket.userId)) {
        const partnerId = activeCallsMap.get(socket.userId);
        const partnerSocketId = userSocketMap.get(partnerId);
        if (partnerSocketId) {
          console.log(`Notifying partner ${partnerId} that user ${socket.userId} disconnected`);
          io.to(partnerSocketId).emit("callEnded");
        }
        activeCallsMap.delete(socket.userId);
        activeCallsMap.delete(partnerId);
      }
      if (socket.userId && userSocketMap.get(socket.userId) === socket.id) {
        userSocketMap.delete(socket.userId);
        console.log(`Removed user ${socket.userId} from socket map.`);
      }
    });

    socket.on("callUser", ({ userToCall, signalData, from, name, bookingId, warrantyId }) => {
      console.log(`Call initiated from ${from} to ${userToCall}`);
      const userToCallSocketId = userSocketMap.get(userToCall);
      if (userToCallSocketId) {
        const room = bookingId
          ? `booking:${bookingId}:user:${userToCall}`
          : `warranty:${warrantyId}:user:${userToCall}`;
         
        // Check if the recipient is in the specified room
        const recipientSocket = io.sockets.sockets.get(userToCallSocketId);
        if (
          // recipientSocket && recipientSocket.rooms.has(room)
          recipientSocket &&
          recipientSocket.rooms.has(room) 
      
        ) {
          if (activeCallsMap.has(from) || activeCallsMap.has(userToCall)) {
            console.log(`Call rejected: One of the users (${from} or ${userToCall}) is already in a call`);
            socket.emit("callFailed", { message: "User is already in a call." });
            return;
          }
          activeCallsMap.set(from, userToCall);
          activeCallsMap.set(userToCall, from);
          io.to(userToCallSocketId).emit("callUser", {
            signal: signalData,
            from,
            name,
            sessionId: `call_${Date.now()}_${from}_${userToCall}`,
            bookingId,
            warrantyId
          });
          console.log(`Call signal sent to ${userToCall} in room ${room}`);
        } else {
          console.log(`User ${userToCall} is not in the room ${room}`);
          socket.emit("callFailed", { message: `User is not in the ${bookingId ? 'booking' : 'warranty'} room.` });
        }
        // activeCallsMap.set(from, userToCall);
        // activeCallsMap.set(userToCall, from);
        // io.to(userToCallSocketId).emit("callUser", { signal: signalData, from, name });
        console.log(`Call signal sent to ${userToCall}`);
      } else {
        console.log(`User ${userToCall} is not online`);
        socket.emit("callFailed", { message: "User is not online." });
      }
    });

    socket.on("answerCall", (data) => {
      console.log(`Call answered by ${socket.userId} to ${data.to}`);
      const callerSocketId = userSocketMap.get(data.to);
      if (callerSocketId) {
        io.to(callerSocketId).emit("callAccepted", data.signal);
      }
    });

    socket.on("ice-candidate", (data) => {
      const recipientSocketId = userSocketMap.get(data.to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("ice-candidate", data.candidate);
      }
    });

    socket.on("callEnded", (data) => {
      console.log(`Call ended by ${socket.userId} to ${data.to}`);
      const recipientSocketId = userSocketMap.get(data.to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("callEnded");
        console.log(`Call ended notification sent to ${data.to}`);
      }
      if (socket.userId) {
        activeCallsMap.delete(socket.userId);
        activeCallsMap.delete(data.to);
        console.log(`Cleaned up call mapping for ${socket.userId} and ${data.to}`);
      }
    });

    socket.on("callDeclined", (data) => {
      console.log(`Call declined by ${socket.userId} to ${data.to}`);
      const callerSocketId = userSocketMap.get(data.to);
      if (callerSocketId) {
        io.to(callerSocketId).emit("callDeclined", { from: socket.userId }); // Send back the decliner's ID
        console.log(`Call declined notification sent to ${data.to}`);
      }
      if (socket.userId) {
        activeCallsMap.delete(socket.userId);
        activeCallsMap.delete(data.to);
        console.log(`Cleaned up call mapping for ${socket.userId} and ${data.to}`);
      }
    });

    socket.on('ping', () => {
      socket.emit('pong');
    });
    socket.on('leaveRoom', ({ room }) => {
      if (room) {
        socket.leave(room);
        console.log(`User ${socket.userId} left room ${room}`);
      }
    });
  });

  return io;
};

module.exports = { initializeSocket, userSocketMap };