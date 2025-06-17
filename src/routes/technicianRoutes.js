const express = require('express');
const router = express.Router();
const { registerAsTechnician, viewTechnicianProfile, getCertificatesByTechnicianId, viewJobDetails, viewEarningsByBooking } = require('../controllers/technicianController');


router.get('/:technicianId', viewTechnicianProfile);
router.get('/:technicianId/certificates', getCertificatesByTechnicianId);
router.get('/:technicianId/earnings',  viewEarningsByBooking);
router.get('/:technicianId/:bookingId',  viewJobDetails);
router.post('/register', registerAsTechnician);

module.exports = router;
