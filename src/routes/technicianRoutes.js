const express = require('express');
const validate = require('../middlewares/validationMiddleware');
const technicianValidation = require('../validations/technicianValidation');
const technicianController = require('../controllers/technicianController');
const router = express.Router();
// const { registerAsTechnician,
//     viewTechnicianProfile,
//     getCertificatesByTechnicianId,
//     viewJobDetails,
//     viewEarningsByBooking,
//     getTechnicianAvailability,
//     updateAvailability,
//     sendQuotation,
//     confirmJobDoneByTechnician } = require('../controllers/technicianController');


router.get('/:technicianId', technicianController.viewTechnicianProfile);
router.get('/:technicianId/certificates', technicianController.getCertificatesByTechnicianId);
router.get('/:technicianId/earnings', technicianController.viewEarningsByBooking);
router.get('/:technicianId/availability', technicianController.getTechnicianAvailability);
router.get('/:technicianId/:bookingId', technicianController.viewJobDetails);
router.put('/:technicianId/availability', technicianController.updateAvailability);
router.post('/register', technicianController.registerAsTechnician);
router.post('/send-quotation', technicianController.sendQuotation);
router.post('/:bookingId/done', technicianController.confirmJobDoneByTechnician);

module.exports = router;
