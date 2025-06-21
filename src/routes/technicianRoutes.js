const express = require('express');
const validate = require('../middlewares/validationMiddleware');
const technicianValidation = require('../validations/technicianValidation');
const technicianController = require('../controllers/technicianController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { handleMulter, processAndUploadToS3 } = require('../middlewares/uploadMiddleware');
const router = express.Router();

router.get('/:technicianId', technicianController.viewTechnicianProfile);
router.get('/:technicianId/certificates', technicianController.getCertificatesByTechnicianId);
router.get('/:technicianId/earnings', technicianController.viewEarningsByBooking);
router.get('/:technicianId/availability', technicianController.getTechnicianAvailability);
router.get('/:technicianId/:bookingId', technicianController.viewJobDetails);
router.put('/:technicianId/availability', technicianController.updateAvailability);
router.post('/register', technicianController.registerAsTechnician);
router.post('/send-quotation', technicianController.sendQuotation);
router.post('/:bookingId/done', technicianController.confirmJobDoneByTechnician);
router.post('/complete-profile', authenticateToken, technicianController.completeTechnicianProfile);
router.post('/upload/certificate', authenticateToken, handleMulter.single('certificate'), processAndUploadToS3('certificates'), technicianController.uploadCertificate);

module.exports = router;
