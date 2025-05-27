const express = require('express');
const app = express();
const routes = require('./routes')

// Parse JSON
app.use(express.json());

// Routes (Định tuyến)
app.use('/api', routes);

module.exports = app;
