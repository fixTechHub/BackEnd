const express = require('express');
const bookingController = require('../controllers/bookingController');
const { handleMulter, processAndUploadToS3 } = require('../middlewares/uploadMiddleware');
const { authenticateToken } = require('../middlewares/authMiddleware');
const router = express.Router();

router.get('/user', authenticateToken, bookingController.getUserBookingHistory)
router.get('/accepted-booking/:bookingId', authenticateToken, bookingController.getAcceptedBooking)

// Routes cho gợi ý mô tả
router.get('/popular-descriptions', bookingController.getPopularDescriptions);
router.get('/search-descriptions', bookingController.searchDescriptions);

router.post('/create-new-booking-request', authenticateToken, handleMulter.array('images', 5), processAndUploadToS3('bookings'), bookingController.createBookingRequest);
router.get('/top-services', bookingController.getTopBookedServices);
router.get('/:id', bookingController.getBookingById);
router.post('/:bookingId/cancel', authenticateToken, bookingController.cancelBooking);
router.post('/:bookingId/done', authenticateToken, bookingController.confirmJobDone);
router.post('/:bookingId/quote', authenticateToken, bookingController.technicianSendQuote);
router.post('/:bookingId/quote/accept', authenticateToken, bookingController.customerAcceptQuote);
router.post('/:bookingId/quote/reject', authenticateToken, bookingController.customerRejectQuote);
router.post('/:bookingId/select-technician', authenticateToken, bookingController.selectTechnicianForBooking);
router.post('/:bookingId/technician-accept', authenticateToken, bookingController.technicianAcceptBooking);
router.post('/:bookingId/technician-reject', authenticateToken, bookingController.technicianRejectBooking);
router.get('/:bookingId/technician-requests', authenticateToken, bookingController.getBookingTechnicianRequests);
router.get('/:bookingId/technicians-found', authenticateToken, bookingController.getTechniciansFoundByBookingId);
router.get('/:bookingId/request-status/:technicianId', authenticateToken, bookingController.getRequestStatusInfo);

module.exports = router;
