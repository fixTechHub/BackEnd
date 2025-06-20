require('dotenv').config();
const app = require('./src/app');
const http = require('http');
const connectDB = require('./src/config/connectDB');
const initializeSocket = require('./src/sockets/socket');

const PORT = process.env.PORT || 3000;

// Tạo server http để tích hợp với Socket.io
const server = http.createServer(app);

// Khởi tạo Socket.io
const io = initializeSocket(server);

// Gán io vào app để có thể truy cập từ các controller/service khác nếu cần
app.set('io', io);

// Connect to MongoDB
connectDB();

server.listen(PORT, () => {
  console.log(`API Gateway running at http://localhost:${PORT}`);
});
