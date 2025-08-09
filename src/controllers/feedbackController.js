const feedbackService = require('../services/feedbackService');
const bookingService = require('../services/bookingService');

const submitFeedback = async (req, res) => {
    try {
        const fromUserId = req.user.userId;
        console.log('req.user:', req.user.userId);
        const { rating, content } = req.body;
        console.log('✅ req.body full:', req.body);
        // console.log("userId tech", req.user);
        
        
        const { bookingId } = req.params;
        // const images = req.uploadedFiles || [];
        const images = req.s3FileUrls || [];

        // 🔍 Lấy thông tin booking
        const booking = await bookingService.getBookingById(bookingId);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // 🔗 Lấy toUserId (tức technician's userId)
        const toUserId = booking.technicianId?.userId?._id;
        console.log("userId tech "+ toUserId);
        
        if (!toUserId) {
            return res.status(400).json({ message: 'Technician not found in booking' });
        }

        const feedback = await feedbackService.submitFeedback({
            bookingId,
            fromUserId,
            toUserId,
            rating,
            content,
            images
        });

        res.status(201).json({
            message: 'Feedback submitted successfully',
            data: feedback
        });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

const editFeedback = async (req, res) => {
    try {
        const { feedbackId } = req.params;
        const { rating, content, images } = req.body;
        const fromUserId = req.user._id;
        console.log(fromUserId);
        
        const result = await feedbackService.editFeedback({ feedbackId, fromUserId, rating, content, images });
        res.status(200).json({ message: 'Feedback updated', data: result });
    } catch (err) {
        res.status(403).json({ message: err.message });
    }
};

const replyToFeedback = async (req, res) => {
    try {
        const { feedbackId } = req.params;
        const { reply } = req.body;
        const technicianId = req.user._id;
        const result = await feedbackService.replyToFeedback({ feedbackId, technicianId, replyText: reply });
        res.status(200).json({ message: 'Reply submitted', data: result });
    } catch (err) {
        res.status(403).json({ message: err.message });
    }
};

const moderateFeedback = async (req, res) => {
    try {
        const { feedbackId } = req.params;
        const { isVisible, reason } = req.body;

        // if (req.user.role !== 'admin') {
        //     return res.status(403).json({ message: 'Only admin can moderate feedback' });
        // }

        const result = await feedbackService.moderateFeedback({ feedbackId, isVisible, reason });
        res.status(200).json({ message: 'Moderation updated', data: result });
    } catch (err) {
        res.status(404).json({ message: err.message });
    }
};

const getFeedbackList = async (req, res) => {
    try {
        const filters = req.query; 
        const list = await feedbackService.getFeedbackList(filters);
        res.status(200).json({ data: list });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

const getAllFeedback = async (req, res) => {
  try {
    const { toUser, fromUser, isVisible, ratingMin, ratingMax } = req.query;

    // ⚙️ Chuẩn hóa dữ liệu filter
    const filter = {
      toUser,
      fromUser,
      isVisible: isVisible !== undefined ? isVisible === 'true' : undefined,
      rating: (ratingMin || ratingMax) ? {
        min: ratingMin ? Number(ratingMin) : undefined,
        max: ratingMax ? Number(ratingMax) : undefined
      } : undefined
    };

    const feedbackList = await feedbackService.getFeedbackList(filter);

    res.status(200).json({
      message: 'Lấy danh sách feedback thành công',
      data: feedbackList
    });
  } catch (error) {
    console.error('❌ Lỗi khi lấy feedback:', error);
    res.status(500).json({
      message: 'Lỗi server khi lấy danh sách feedback',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

module.exports = { submitFeedback, editFeedback, replyToFeedback, moderateFeedback, getFeedbackList, getAllFeedback };