require('dotenv').config();
const app = require('./src/app');
const http = require('http');
const connectDB = require('./src/config/connectDB');
const { initializeSocket } = require('./src/sockets/socket');
const { setIo } = require('./src/sockets/socketManager');
const contractCronService = require('./src/cronjobs/contractCronJob');
const bookingWarrantyCronService = require('./src/cronjobs/warrantyCronJob')
const PORT = process.env.PORT || 3000;

// Create an HTTP server from the Express app
const server = http.createServer(app);

// Initialize Socket.IO and get the io instance
const io = initializeSocket(server);

setIo(io);

// Connect to MongoDB


connectDB();
// contractCronService.startCronJobs(); // Start the cron jobs after MongoDB connection
// bookingWarrantyCronService.startCronJobs()
server.listen(PORT, () => {
  console.log(`API Gateway running at http://localhost:${PORT}`);
});


