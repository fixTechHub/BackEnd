const feedbackService = require('../services/feedbackService');
const bookingService = require('../services/bookingService');

const submitFeedback = async (req, res) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const fromUserId = req.user.userId;
        const { rating, content } = req.body;
        const { bookingId } = req.params;
        const filesMeta = Array.isArray(req.uploadedFiles) ? req.uploadedFiles : [];
        const images = filesMeta.length ? filesMeta.map(f => f.url) : (req.s3FileUrls || []);

        // 🔍 Lấy thông tin booking
        const booking = await bookingService.getBookingById(bookingId);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // 🔗 Lấy toUserId (tức technician's userId)
        const toUserId = booking.technicianId?.userId?._id;

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
        console.error('Submit feedback error:', err);
        const code = err.statusCode || err.code || err.status || 400;
        return res.status(code).json({ message: err.message || 'Bad Request' });
    }
};

const editFeedback = async (req, res) => {
    try {
        const { feedbackId } = req.params;
        const { rating, content, images } = req.body;
        const fromUserId = req.user._id || req.user.userId;
        console.log("id", fromUserId);

        const result = await feedbackService.editFeedback({ feedbackId, fromUserId, rating, content, images });
        res.status(200).json({ message: 'Feedback updated', data: result });
    } catch (err) {
        res.status(403).json({ message: err.message });
    }
};

const replyToFeedbackController = async (req, res) => {
    try {
        const { feedbackId } = req.params;
        const replyText =
            (req.body?.reply && req.body.reply.content) ??
            req.body?.reply ??
            req.body?.content ?? '';

        const userId = req.user?._id || req.user?.userId; // userId trong token
        if (!userId) return res.status(401).json({ message: 'Chưa đăng nhập' });

        const data = await feedbackService.replyToFeedback({ feedbackId, userId, replyText });
        return res.status(200).json({ message: 'Reply submitted', data });
    } catch (err) {
        console.error('replyToFeedback error:', err);
        return res.status(err.status || 500).json({ message: err.message || 'Server error' });
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

const listByTechnician = async (req, res) => {
    try {
        const { technicianId } = req.params;
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '10', 10);

        const result = await feedbackService.findByTechnician({ technicianId, page, limit });
        res.status(200).json({ message: 'OK', ...result });
    } catch (err) {
        res.status(400).json({ message: err.message || 'Cannot get feedbacks' });
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

const getFeedbacksByFromUser = async (req, res) => {
    try {
        const { userId } = req.params;
        console.log("Fetching feedbacks for user:", userId);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const result = await feedbackService.getFeedbacksByFromUser(userId, page, limit);

        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message || 'Server Error' });
    }
};

const listFeedbacksForTechnician = async (req, res, next) => {
    try {
        const { technicianId } = req.params;
        const result = await feedbackService.listFeedbacksByTechnician(technicianId, req.query);
        res.json(result);
    } catch (err) {
        next(err);
    }
};

const feedbackStatsForTechnician = async (req, res, next) => {
    try {
        const { technicianId } = req.params;
        const stats = await feedbackService.getFeedbackStatsByTechnician(technicianId);
        res.json(stats);
    } catch (err) {
        next(err);
    }
};

const fetchByBookingId = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const items = await feedbackService.getFeedbacksByBookingId(bookingId);
        res.json({ items, total: items.length });
    } catch (err) {
        console.error('fetchByBookingId error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    submitFeedback,
    editFeedback,
    replyToFeedback: replyToFeedbackController,
    moderateFeedback,
    getFeedbackList,
    getAllFeedback,
    listByTechnician,
    listFeedbacksForTechnician,
    feedbackStatsForTechnician,
    getFeedbacksByFromUser,
    fetchByBookingId
};