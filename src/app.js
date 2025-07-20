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
        origin: [
            process.env.FRONT_END_URL, // http://localhost:5173
            'http://localhost:5173', // Explicitly include for safety
            'http://localhost:5174',
            'https://*.ngrok-free.app', // Allow all ngrok-free.app URLs
            'https://b8d9-2001-ee0-4b7b-3bd0-2d89-bdfa-7310-9e33.ngrok-free.app',
            'https://fixtech.id.vn',
            'https://fix-tech-git-develop-tris-projects-f8fdb778.vercel.app'
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: ['set-cookie']
    })
);

// app.use(actionLogger);

// Routes (Định tuyến)
app.use('/api', routes);

module.exports = app;