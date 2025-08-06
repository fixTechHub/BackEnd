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
    console.log("id"+ feedbackId);
    
    const feedback = await Feedback.findById(feedbackId);
    console.log("f" ,feedback);

    if (!feedback) throw new Error('Feedback not found');
    if (!feedback.fromUser || !feedback.fromUser.equals(fromUserId)) {
        throw new Error('You are not authorized to edit this feedback');
    }

    feedback.rating = rating;
    feedback.content = content;
    feedback.images = images || [];
    return await feedback.save();
};

const replyToFeedback = async ({ feedbackId, technicianId, replyText }) => {
    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) throw new Error('Feedback not found');
    // if (!feedback.toUser.equals(technicianId)) {
    //     throw new Error('You are not authorized to reply to this feedback');
    // }
    // if (feedback.reply && feedback.reply.content) {
    //     throw new Error('This feedback has already been replied');
    // }

    feedback.reply = {
        content: replyText,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    return await feedback.save();
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
        .populate('fromUser', 'fullName')
        .populate('toUser', 'fullName')
        .populate('bookingId', 'serviceId address appointmentTime');
};

module.exports = { submitFeedback, editFeedback, replyToFeedback, moderateFeedback, getFeedbackList };