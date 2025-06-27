// This module acts as a singleton for the Socket.IO server instance.
let io = null;

const setIo = (ioInstance) => {
    if (!ioInstance) {
        throw new Error('Socket.IO instance cannot be null or undefined.');
    }
    console.log('Socket.IO instance set in manager.');
    io = ioInstance;
};

const getIo = () => {
    if (!io) {
        // This should not happen in the normal flow of the application
        // if server.js initializes it correctly.
        console.error('Socket.IO instance has not been set. Please check server.js');
        throw new Error('Socket.IO not initialized');
    }
    return io;
};

module.exports = { setIo, getIo }; 