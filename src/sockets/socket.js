const { Server } = require('socket.io');

const initializeSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*", // Trong thực tế, nên giới hạn lại domain của client
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log(`A user connected: ${socket.id}`);

        // Tham gia một "phòng" dựa trên ID người dùng
        socket.on('join_room', (userId) => {
            socket.join(userId);
            console.log(`User ${socket.id} joined room ${userId}`);
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
        });
    });

    return io;
};

module.exports = initializeSocket;