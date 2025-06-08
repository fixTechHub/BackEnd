const express = require('express');
const cors = require('cors');
const app = express();
const routes = require('./routes')
const actionLogger = require('./middlewares/actionLogger');

app.use(cors());

// Parse JSON
app.use(express.json());

// Middleware logging hành động
app.use(actionLogger);

// Routes (Định tuyến)
app.use('/api', routes);

module.exports = app;
