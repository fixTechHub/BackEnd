const express = require('express');
const cors = require('cors');
const app = express();
const routes = require('./routes')
const actionLogger = require('./middlewares/actionLogger');

// Allow basic cross-origin requests
app.use(cors());

// Parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware logging hành động
app.use(actionLogger);

// Routes (Định tuyến)
app.use('/api', routes);

module.exports = app;
