require('dotenv').config();
const app = require('./src/app');
const http = require('http');
const connectDB = require('./src/config/connectDB');
const { initializeSocket } = require('./src/sockets/socket');
const { setIo } = require('./src/sockets/socketManager');
const contractCronService = require('./src/cronjobs/contractCronJob');
const { startRequestExpirationCron } = require('./src/cronjobs/requestExpirationCron');
require('./src/cronjobs/ex');
// require('./src/cronjobs/technicianSearchCron.js');

const PORT = process.env.PORT || 3000;

// Create an HTTP server from the Express app
const server = http.createServer(app);

// Initialize Socket.IO and get the io instance
const io = initializeSocket(server);

setIo(io);

// Connect to MongoDB
const startServer = async () => {
  try {
    await connectDB();
    
    // Khởi động các cronjobs
    startRequestExpirationCron();
    
    server.listen(PORT, () => {
      console.log(`API Gateway running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
