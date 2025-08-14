const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');

router.get('/public', serviceController.getPublicServices);
router.get('/:id/public', serviceController.getPublicServicesByCategoryId);
router.post('/suggest-services', serviceController.suggestServices);
router.get('/address-suggestions', serviceController.getAddressSuggestions);
router.post('/geocode-address', serviceController.geocodeAddress);
router.get('/test', serviceController.testEndpoint);

module.exports = router;
