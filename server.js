require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/connectDB');
const PORT = process.env.PORT || 3000;
const initializeSocket = require('./src/sockets/socket');
// Connect to MongoDB
connectDB();

const server = http.createServer(app);

initializeSocket(server);

server.listen(PORT, () => {
  console.log(`API Gateway running at http://localhost:${PORT}`);
});
