require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const cookieParser = require("cookie-parser");
const routes = require('./routes')
const actionLogger = require('./middlewares/actionLogger');

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// Parse JSON
app.use(express.json());

app.use(
    cors({
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: ['set-cookie']
    })
);

app.use(actionLogger);
// Routes (Định tuyến)
app.use('/api', routes);

module.exports = app;