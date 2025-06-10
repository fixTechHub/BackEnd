require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const cookieParser = require("cookie-parser");
const routes = require('./routes')
const actionLogger = require('./middlewares/actionLogger');

app.use(cors());

// Parse JSON
app.use(express.json());

// Routes (Định tuyến)
app.use('/api', routes);

module.exports = app;
