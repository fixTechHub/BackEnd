require('dotenv').config();
const http = require('http'); // Import the http module
const app = require('./src/app');
const http = require('http');
const connectDB = require('./src/config/connectDB');
const initializeSocket = require('./src/sockets/socket'); // Import the socket initializer
const ioMiddleware = require('./src/middlewares/ioMiddleware');

const PORT = process.env.PORT || 3000;

// Create an HTTP server from the Express app
const server = http.createServer(app);

// Initialize Socket.IO and get the io instance
const io = initializeSocket(server);

app.use(ioMiddleware(io));

// Connect to MongoDB
connectDB();

server.listen(PORT, () => {
  console.log(`API Gateway running at http://localhost:${PORT}`);
});
