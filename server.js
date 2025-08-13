require('dotenv').config();
const app = require('./src/app');
const http = require('http');
const connectDB = require('./src/config/connectDB');
const { initializeSocket } = require('./src/sockets/socket');
const { setIo } = require('./src/sockets/socketManager'); 

const { startRequestExpirationCron } = require('./src/cronjobs/requestExpirationCron');

// Import các cron jobs
require('./src/cronjobs/ex');
require('./src/cronjobs/technicianSearchCron.js');
require('./src/cronjobs/contractCronJob');
require('./src/cronjobs/warrantyCronJob.js');
const PORT = process.env.PORT || 3000;

// Create an HTTP server from the Express app
const server = http.createServer(app);

// Cấu hình server để xử lý proxy headers
server.on('request', (req, res) => {
    // Đảm bảo X-Forwarded-For được xử lý đúng
    if (req.headers['x-forwarded-for']) {
        req.connection.remoteAddress = req.headers['x-forwarded-for'].split(',')[0].trim();
    }
});

// Initialize Socket.IO and get the io instance
const io = initializeSocket(server);

setIo(io);

// Graceful shutdown function
const gracefulShutdown = (signal) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    
    // Dừng server
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
    
    // Force exit sau 10 giây nếu không thể dừng gracefully
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

// Listen for shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Connect to MongoDB
const startServer = async () => {
  try {
    await connectDB();
    
    // Khởi động các cronjobs
    startRequestExpirationCron();
    
    server.listen(PORT, () => {
      console.log(`API 2 Gateway running at http://localhost:${PORT}`);
      console.log('Cron jobs initialized successfully');
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
