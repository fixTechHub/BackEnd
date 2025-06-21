require('dotenv').config();
const http = require('http'); // Import the http module
const app = require('./src/app');
const connectDB = require('./src/config/connectDB');
const initializeSocket = require('./src/sockets/socket'); // Import the socket initializer

const PORT = process.env.PORT || 3000;

// Create an HTTP server from the Express app
const server = http.createServer(app);

// Initialize Socket.IO and get the io instance
const io = initializeSocket(server);

// Middleware to attach the io instance to every request


// Connect to MongoDB
connectDB();

// Listen on the http server, not the Express app
server.listen(PORT, () => {
  console.log(`API Gateway with Socket.IO running at http://localhost:${PORT}`);
});
