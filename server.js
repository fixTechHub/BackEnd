require('dotenv').config();
const app = require('./src/app');
const http = require('http');
const connectDB = require('./src/config/connectDB');
const initializeSocket = require('./src/sockets/socket');
const { setIo } = require('./src/sockets/socketManager');

const PORT = process.env.PORT || 3000;

// Create an HTTP server from the Express app
const server = http.createServer(app);

// Initialize Socket.IO and get the io instance
const io = initializeSocket(server);

setIo(io);

// Connect to MongoDB
connectDB();

server.listen(PORT, () => {
  console.log(`API Gateway running at http://localhost:${PORT}`);
});
