const express = require('express');
const validate = require('../middlewares/validationMiddleware');
const technicianValidation = require('../validations/technicianValidation');
const technicianController = require('../controllers/technicianController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { handleMulter, processAndUploadToS3 } = require('../middlewares/uploadMiddleware');

const router = express.Router();
router.get('/technician-deposit',authenticateToken,technicianController.getTechnicianDepositLogs);
router.get('/:technicianId', technicianController.viewTechnicianProfile);
router.get('/:technicianId/certificates', technicianController.getCertificatesByTechnicianId);
router.get('/:technicianId/earnings', technicianController.viewEarningsByBooking);
router.get('/:technicianId/availability', technicianController.getTechnicianAvailability);
router.get('/:technicianId/bookings', technicianController.viewTechnicianBookings);
router.get('/:technicianId/bookings/:bookingId', technicianController.viewJobDetails);
router.put('/:technicianId/availability', technicianController.updateAvailability);
router.post('/register', technicianController.registerAsTechnician);
router.post('/send-quotation', authenticateToken, technicianController.sendQuotation);
router.post('/:bookingId/done', technicianController.confirmJobDoneByTechnician);
router.post('/:technicianId/deposit', technicianController.depositMoney);
router.post('/:technicianId/withdraw', technicianController.requestWithdraw);
router.post('/complete-profile', authenticateToken, handleMulter.fields([{ name: 'frontIdImage', maxCount: 1 }, { name: 'backIdImage', maxCount: 1 }, { name: 'certificates', maxCount: 10 }]), technicianController.completeTechnicianProfile);
router.post('/upload/certificate', authenticateToken, handleMulter.single('certificate'), processAndUploadToS3('certificates'), technicianController.uploadCertificate);
router.post('/upload/cccd', authenticateToken, handleMulter.fields([{ name: 'frontIdImage', maxCount: 1 }, { name: 'backIdImage', maxCount: 1 }]), processAndUploadToS3('cccd'), technicianController.uploadCCCDImages);


module.exports = router;
