require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/connectDB'); // Adjust path to your connectDB.js file
const contractCronService = require('../cronjobs/contractCronJob'); // Adjust path to your ContractCronService.js file
const { initializeSocket } = require('../sockets/socket');
const { setIo } = require('../sockets/socketManager');
const http = require('http');


// Create HTTP server for Socket.IO
const server = http.createServer();

// Initialize Socket.IO with the server
const io = initializeSocket(server);
setIo(io);

// Start the server on a test port
const TEST_PORT = process.env.TEST_PORT || 3001;
server.listen(TEST_PORT, () => {
  console.log(`Test server running on port ${TEST_PORT}`);
});

// Save the original Date constructor
const OriginalDate = global.Date;

// Function to mock the Date object to February 1st, 2026
function mockDate() {
  const mockDate = new OriginalDate('2026-02-01T09:00:00Z'); // Set to 9:00 AM UTC, Feb 1, 2026 (4:00 PM +07)

  global.Date = class extends OriginalDate {
    constructor(...args) {
      if (args.length === 0) {
        return new OriginalDate(mockDate);
      }
      return new OriginalDate(...args);
    }

    static now() {
      return mockDate.getTime();
    }
  };

  return OriginalDate; // Return original Date for restoration
}

// Function to restore the original Date object
function restoreDate() {
  global.Date = OriginalDate;
}

// Main test function
async function runTest() {
  let originalDate;
  try {
    // Connect to MongoDB using connectDB
    console.log('Connecting to MongoDB...');
    await connectDB();
    console.log('MongoDB connection established');

    // Mock the Date object
    originalDate = mockDate();
    console.log('Mocked date to:', new Date().toISOString());

    // Instantiate and run the cron service manually
    await contractCronService.runManualCheck();

    // Restore the original Date object
    restoreDate();
    console.log('Restored original Date object');

    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');

    // Close the test server
    server.close(() => {
      console.log('Test server closed');
    });
  } catch (error) {
    console.error('Test failed:', error.message);
    // Ensure Date is restored and connection is closed on error
    if (originalDate) {
      restoreDate();
    }
    await mongoose.connection.close();
    server.close();
  }
}

// Run the test
runTest().then(() => {
  console.log('Test script completed');
  process.exit(0);
}).catch((error) => {
  console.error('Test script failed:', error.message);
  process.exit(1);
});