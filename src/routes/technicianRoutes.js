const express = require('express');
const validate = require('../middlewares/validationMiddleware');
const technicianValidation = require('../validations/technicianValidation');
const technicianController = require('../controllers/technicianController');
const router = express.Router();

router.post('/send-quotation', technicianController.sendQuotation);
router.post('/:bookingId/done', technicianController.confirmJobDoneByTechnician);

module.exports = router;
