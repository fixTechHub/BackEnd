const BookingWarranty = require('../models/BookingWarranty')
const Booking = require('../models/Booking')
const mongoose = require('mongoose');
const messageService = require('./messageService')
const { getIo } = require('../sockets/socketManager')
const notificationService = require('./notificationService')
const requestWarranty = async (bookingId) => {
    const io = getIo()
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            throw new Error('ID đặt lịch không hợp lệ');
        }
        const booking = await Booking.findById(bookingId)
        const requestDate = new Date();
        const expireAt = new Date(requestDate);
        expireAt.setDate(requestDate.getDate() + 1);
        const bookingWarranty = new BookingWarranty({
            bookingId,
            customerId: booking.customerId,
            technicianId: booking.technicianId,
            requestDate: requestDate,
            reportedIssue: 'Khách hàng yêu cầu bảo hành',
            isUnderWarranty: true,
            status: 'PENDING',
            expireAt:expireAt
        });
        await bookingWarranty.save({ session });
        const messageData = {
            bookingId,
            fromUser: booking.technicianId,
            toUser: booking.customerId,
            content: 'Bạn đang gặp sự cố gì có thể nói cho tôi biết!',
            type: 'SUPPORT',
        }
        const newMessage = await messageService.createMessage(messageData)
        const notificationData = {
            userId: newMessage.fromUser,
            title: `Đơn bảo hành`,
            content: `Bạn nhận được 1 dơn bảo hành từ đơn ${booking.bookingCode}.`,
            type: 'NEW_REQUEST',
            referenceId: bookingWarranty._id,
            referenceModel: 'BookingWarranty',
            url: `warranty?bookingWarrantyId=${bookingWarranty._id}`
        };
        const notification = await notificationService.createNotification(notificationData);
        io.to(`user:${notification.userId}`).emit('receiveNotification', notification);
        io.to(`user:${newMessage.fromUser}`).emit('receiveMessage', newMessage);
        io.to(`user:${newMessage.toUser}`).emit('receiveMessage', newMessage);
        await session.commitTransaction();
        session.endSession();
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.log(error);

        throw error

    }
}

module.exports = {
    requestWarranty
};