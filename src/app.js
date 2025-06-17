require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const cookieParser = require("cookie-parser");
const routes = require('./routes')
const actionLogger = require('./middlewares/actionLogger');
const { handleTemporarySession } = require('./middlewares/sessionMiddleware');

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// Parse JSON
app.use(express.json());
app.use(
    cors({
        origin: process.env.FRONT_END_URL,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-session-type'],
        exposedHeaders: ['set-cookie']
    })
);

// Add session middleware
app.use(handleTemporarySession);

app.use(actionLogger);
// Routes (Định tuyến)
app.use('/api', routes);

module.exports = app;