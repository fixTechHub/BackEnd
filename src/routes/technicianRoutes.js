const express = require('express');
const validate = require('../middlewares/validationMiddleware');
const technicianValidation = require('../validations/technicianValidation');
const technicianController = require('../controllers/technicianController');
const router = express.Router();
const { registerAsTechnician,
    viewTechnicianProfile,
    getCertificatesByTechnicianId,
    viewJobDetails,
    viewEarningsByBooking,
    getTechnicianAvailability,
    updateAvailability,
    sendQuotation,
    confirmJobDoneByTechnician } = require('../controllers/technicianController');


router.get('/:technicianId', viewTechnicianProfile);
router.get('/:technicianId/certificates', getCertificatesByTechnicianId);
router.get('/:technicianId/earnings', viewEarningsByBooking);
router.get('/:technicianId/availability', getTechnicianAvailability);
router.get('/:technicianId/:bookingId', viewJobDetails);
router.put('/:technicianId/availability', updateAvailability);
router.post('/register', registerAsTechnician);
router.post('/send-quotation', sendQuotation);
router.post('/:bookingId/done', confirmJobDoneByTechnician);

module.exports = router;
