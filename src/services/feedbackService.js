const Feedback = require('../models/Feedback');
const Booking = require('../models/Booking');
const Technician = require('../models/Technician');
const mongoose = require('mongoose');

const submitFeedback = async ({ bookingId, fromUserId, rating, content, images }) => {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new Error('Booking not found');

    if (booking.customerId.toString() !== fromUserId.toString()) {
        throw new Error('You are not allowed to rate this booking');
    }

    if (booking.status !== 'DONE') {
        throw new Error('Only completed bookings can be rated');
    }

    if (booking.paymentStatus !== 'PAID') {
        throw new Error('Only paid bookings can be rated');
    }

    const existing = await Feedback.findOne({ bookingId });
    if (existing) {
        throw new Error('Feedback for this booking already exists');
    }

    const feedback = new Feedback({
        bookingId,
        fromUser: fromUserId,
        toUser: booking.technicianId,
        rating,
        content,
        images
    });

    await feedback.save();

    const allFeedbacks = await Feedback.find({ toUser: booking.technicianId });
    const avgRating = allFeedbacks.reduce((acc, cur) => acc + cur.rating, 0) / allFeedbacks.length;

    await Technician.findByIdAndUpdate(booking.technicianId, { ratingAverage: avgRating });

    return feedback;
};

const editFeedback = async ({ feedbackId, fromUserId, rating, content, images }) => {
    console.log("id" + feedbackId);

    const feedback = await Feedback.findById(feedbackId);
    console.log("f", feedback);

    if (!feedback) throw new Error('Feedback not found');
    if (!feedback.fromUser || !feedback.fromUser.equals(fromUserId)) {
        throw new Error('You are not authorized to edit this feedback');
    }

    feedback.rating = rating;
    feedback.content = content;
    feedback.images = images || [];
    return await feedback.save();
};

const httpError = (status, message) => {
    const e = new Error(message);
    e.status = status;
    return e;
};

const replyToFeedback = async ({ feedbackId, userId, replyText }) => {
    if (!mongoose.Types.ObjectId.isValid(feedbackId)) {
        throw new Error('feedbackId không hợp lệ');
    }

    const fb = await Feedback.findById(feedbackId);
    if (!fb) throw new Error('Feedback not found');

    const tech = await Technician.findOne({ userId: userId }).select('_id').lean();
    console.log(tech);

    // 👇 DEBUG log trước khi so sánh
    console.log('[reply] tokenUserId   =', String(userId));
    //   console.log('[reply] technicianId  =', String(tech._id));
    console.log('[reply] feedback.toUser=', String(fb.toUser));

    // Map userId -> technicianId

    if (!tech) throw new Error('Không tìm thấy technician cho user hiện tại');


    // ✅ So sánh technicianId với fb.toUser (vì fb.toUser đang là technicianId)
    if (String(fb.toUser) !== String(tech._id)) {
        throw new Error('Bạn không có quyền trả lời feedback này');
    }

    const now = new Date();
    fb.reply = {
        content: String(replyText || '').trim(),
        createdAt: fb.reply?.createdAt || now,
        updatedAt: now
    };

    await fb.save();
    return fb;
};

const moderateFeedback = async ({ feedbackId, isVisible, reason }) => {
    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) throw new Error('Feedback not found');

    feedback.isVisible = isVisible;
    feedback.hiddenReason = isVisible ? null : reason;
    return await feedback.save();
};

const getFeedbackList = async (filter = {}) => {
    const query = {};
    if (filter.toUser) query.toUser = new mongoose.Types.ObjectId(filter.toUser);
    if (filter.fromUser) query.fromUser = new mongoose.Types.ObjectId(filter.fromUser);
    if (filter.isVisible !== undefined) query.isVisible = filter.isVisible;
    if (filter.rating) query.rating = { $gte: filter.rating.min, $lte: filter.rating.max };

    return await Feedback.find(query)
        .sort({ createdAt: -1 })
        .populate('fromUser', 'fullName avatar address') // ✅ Thêm avatar và address
        .populate('toUser', 'fullName')
        .populate({
            path: 'bookingId',
            select: 'serviceId address appointmentTime finalPrice quote',
            populate: {
                path: 'serviceId',
                select: 'serviceName'
            }
        }); // ✅ Lấy service name và price thật
};

const findByTechnician = async ({
    technicianId,
    page = 1,
    limit = 10,
    rating,               // 1..5 (optional)
    sort = 'recent',      // 'recent' | 'rating_desc' | 'rating_asc'
    from,                 // 'YYYY-MM-DD' (optional)
    to,                   // 'YYYY-MM-DD' (optional)
    visible = true,       // default: chỉ lấy feedback hiển thị
}) => {
    if (!mongoose.Types.ObjectId.isValid(technicianId)) {
        throw new Error('technicianId không hợp lệ');
    }

    const filter = {
        toUser: technicianId,               // ⚠️ fb.toUser = technicianId
        ...(typeof visible === 'boolean' ? { isVisible: visible } : {}),
        ...(rating ? { rating: Number(rating) } : {}),
    };

    if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to) filter.createdAt.$lte = new Date(to);
    }

    const sortObj =
        sort === 'rating_desc' ? { rating: -1, createdAt: -1 } :
            sort === 'rating_asc' ? { rating: 1, createdAt: -1 } :
                { createdAt: -1 };

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
        Feedback.find(filter)
            .populate('fromUser', 'fullName email avatar')
            .sort(sortObj)
            .skip(skip)
            .limit(limit)
            .lean(),
        Feedback.countDocuments(filter),
    ]);

    return {
        items,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    };
};


const getFeedbackListAdmin = async (filter = {}) => {
    const query = {};

    // ✅ Validate ObjectId trước khi thêm vào query
    if (filter.toUser && mongoose.Types.ObjectId.isValid(filter.toUser)) {
        query.toUser = filter.toUser;
    }

    if (filter.fromUser && mongoose.Types.ObjectId.isValid(filter.fromUser)) {
        query.fromUser = filter.fromUser;
    }

    // ✅ Lọc feedback ẩn/hiện
    if (typeof filter.isVisible === 'boolean') {
        query.isVisible = filter.isVisible;
    }

    // ✅ Lọc theo khoảng rating
    if (filter.rating) {
        const { min, max } = filter.rating;
        query.rating = {};

        if (typeof min === 'number') query.rating.$gte = min;
        if (typeof max === 'number') query.rating.$lte = max;

        // Nếu không có giá trị hợp lệ thì bỏ field rating để tránh query rỗng
        if (Object.keys(query.rating).length === 0) delete query.rating;
    }

    // ✅ Query feedback
    return await Feedback.find(query)
        .sort({ createdAt: -1 }) // feedback mới nhất trước
        .populate('fromUser', 'fullName avatar address') // ✅ Lấy đầy đủ thông tin người gửi
        .populate('toUser', 'fullName')   // chỉ lấy tên người nhận
        .populate({
            path: 'bookingId',
            select: 'serviceId address appointmentTime finalPrice quote',
            populate: {
                path: 'serviceId',
                select: 'serviceName'
            }
        }); // ✅ Lấy service name và price thật
};

const getFeedbacksByFromUser = async (userId, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
        Feedback.find({ fromUser: userId })
            .populate('fromUser', 'name email')
            .populate({
                path: 'toUser', // ở đây đang lưu technicianId
                model: 'Technician',
                populate: {
                    path: 'userId', // userId trong Technician
                    model: 'User',
                    select: 'fullName email'
                }
            })
            .populate({
                path: 'bookingId',
                model: 'Booking',
                select: 'status description'
            })
            // .populate('bookingId', 'status date')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Feedback.countDocuments({ fromUser: userId }),

    ]);
    console.log(JSON.stringify(items, null, 2))

    return {
        items,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    };
};

const getFeedbacksByBookingId = async (bookingId) => {
    const items = await Feedback.find({ bookingId })
        .populate('fromUser', 'name email')
        .populate({
            path: 'toUser', // ở đây đang lưu technicianId
            model: 'Technician',
            populate: {
                path: 'userId', // userId trong Technician
                model: 'User',
                select: 'fullName email'
            }
        })
        .populate('bookingId', 'status date service')
        .sort({ createdAt: -1 });

    return items;
};

// Helper: parse bool từ query (?visible=true/false)
function parseBoolean(val, def) {
    if (val === undefined) return def;
    if (val === 'true' || val === true) return true;
    if (val === 'false' || val === false) return false;
    return def;
}

// Helper: build sort
function buildSort(sortKey) {
    if (sortKey === 'rating_desc') return { rating: -1, createdAt: -1 };
    if (sortKey === 'rating_asc') return { rating: 1, createdAt: -1 };
    return { createdAt: -1 }; // recent
}

// Lấy userId từ technicianId (vì Feedback.toUser là userId)
async function getTechnicianUserId(technicianId) {
    if (!mongoose.isValidObjectId(technicianId)) {
        const err = new Error('technicianId không hợp lệ');
        err.status = 400;
        throw err;
    }
    const tech = await Technician.findById(technicianId).select('user').lean();
    if (!tech) {
        const err = new Error('Không tìm thấy technician');
        err.status = 404;
        throw err;
    }
    return tech.user;
}

// List feedbacks theo technicianId (map sang userId)
async function listFeedbacksByTechnician(technicianId, query = {}) {
    const userId = await getTechnicianUserId(technicianId);

    const page = Math.max(parseInt(query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(query.limit || '10', 10), 1), 100);
    const rating = query.rating ? parseInt(query.rating, 10) : undefined;
    const visible = parseBoolean(query.visible, true);
    const sort = buildSort(query.sort);

    const filter = {
        toUser: userId,
        ...(visible !== undefined ? { isVisible: visible } : {}),
        ...(rating ? { rating } : {}),
    };

    // Khoảng thời gian (optional): ?from=2024-01-01&to=2024-12-31
    if (query.from || query.to) {
        filter.createdAt = {};
        if (query.from) filter.createdAt.$gte = new Date(query.from);
        if (query.to) filter.createdAt.$lte = new Date(query.to);
    }

    const [items, total] = await Promise.all([
        Feedback.find(filter)
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(limit)
            .populate({ path: 'fromUser', select: 'fullName avatar address _id' }) // ✅ Fix field name và thêm address
            .populate({
                path: 'bookingId',
                select: 'bookingCode serviceId schedule finalPrice quote _id',
                populate: {
                    path: 'serviceId',
                    select: 'serviceName'
                }
            }) // ✅ Lấy service name và price thật
            .lean(),
        Feedback.countDocuments(filter),
    ]);

    return {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        items,
    };
}

// Stats: average + distribution theo technicianId
async function getFeedbackStatsByTechnician(technicianId) {
    const userId = await getTechnicianUserId(technicianId);

    const match = { toUser: new mongoose.Types.ObjectId(userId), isVisible: true };

    const agg = await Feedback.aggregate([
        { $match: match },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
    ]);

    const total = agg.reduce((s, x) => s + x.count, 0);
    const sum = agg.reduce((s, x) => s + x._id * x.count, 0);
    const average = total ? sum / total : 0;

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    agg.forEach(x => { distribution[x._id] = x.count; });

    return {
        averageRating: Number(average.toFixed(2)),
        total,
        distribution,
    };
}

module.exports = {
    submitFeedback,
    editFeedback,
    replyToFeedback,
    moderateFeedback,
    getFeedbackList,
    getFeedbackListAdmin,
    findByTechnician,
    listFeedbacksByTechnician,
    getFeedbackStatsByTechnician,
    getTechnicianUserId,
    getFeedbacksByFromUser,
    getFeedbacksByBookingId
};