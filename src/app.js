const express = require('express');
const cors = require('cors');
const app = express();
const routes = require('./routes')

app.use(cors());

// Parse JSON
app.use(express.json());

// Routes (Định tuyến)
app.use('/api', routes);

module.exports = app;
