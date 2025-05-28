const express = require('express');
const router = express.Router();

router.get('/test', (req, res) => res.json('This is API Admin test page'));

module.exports = router;
