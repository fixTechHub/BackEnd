const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');

router.get('/public', serviceController.getPublicServices);
router.get('/:id/public', serviceController.getPublicServicesByCategoryId);

module.exports = router;
