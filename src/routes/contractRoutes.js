const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { handleMulter, processAndUploadToS3 } = require('../middlewares/uploadMiddleware');

router.post(
    '/create-envelope',
    authenticateToken,
    handleMulter.single('document'),
    processAndUploadToS3('contracts'),
    contractController.createEnvelope
);

router.post('/webhook', contractController.handleDocuSignWebhook);

module.exports = router;