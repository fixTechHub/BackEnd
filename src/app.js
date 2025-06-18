require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const cookieParser = require("cookie-parser");
const routes = require('./routes')
const actionLogger = require('./middlewares/actionLogger');
const { scheduleExpiredContractCheck } = require('./utils/scheduler');

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// Parse JSON
app.use(express.json());
app.use(
    cors({
        origin: `${process.env.FRONT_END_URL}`, // Change this to your frontend URL
        credentials: true, // Allows cookies to be sent from frontend
    })
);

app.use(actionLogger);
// Routes (Định tuyến)
app.use('/api', routes);

// Initialize the scheduler
scheduleExpiredContractCheck();

module.exports = app;