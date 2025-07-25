const express = require('express');
const router = express.Router();
const bookingWarrantyController = require('../controllers/bookingWarrantyController')
const { authenticateToken } = require('../middlewares/authMiddleware');
const { handleMulter, processAndUploadToS3 } = require('../middlewares/uploadMiddleware');

router.post('/', authenticateToken,handleMulter.array('images', 5), processAndUploadToS3('bookingWarranties'), bookingWarrantyController.requestBookingWarranty);
router.get('/:bookingWarrantyId',authenticateToken, bookingWarrantyController.getBookingWarrantyById)
router.patch('/accept/:bookingWarrantyId',authenticateToken,bookingWarrantyController.acceptWarranty)
router.patch('/deny/:bookingWarrantyId',authenticateToken,bookingWarrantyController.denyWarranty)
router.patch('/confirm/:bookingWarrantyId',authenticateToken,bookingWarrantyController.confirmWarranty)
router.post('/propose-schedule/:bookingWarrantyId',authenticateToken, bookingWarrantyController.proposeWarrantySchedule)
router.post('/confirm-schedule/:bookingWarrantyId',authenticateToken, bookingWarrantyController.confirmWarrantySchedule)
module.exports = router;
