const express = require('express');
const router = express.Router();
const { registerAsTechnician, viewTechnicianProfile, getCertificatesByTechnicianId, viewJobDetails } = require('../controllers/technicianController');


router.get('/:technicianId', viewTechnicianProfile);
router.get('/:technicianId/certificates', getCertificatesByTechnicianId);
router.get('/:technicianId/:bookingId',  viewJobDetails);
router.post('/register', registerAsTechnician);

module.exports = router;
