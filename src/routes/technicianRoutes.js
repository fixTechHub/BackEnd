const express = require('express');
const router = express.Router();
const { registerAsTechnician } = require('../controllers/technicianController');

router.post('/register', registerAsTechnician);

module.exports = router;
