const BookingWarranty = require('../models/BookingWarranty')
const Booking = require('../models/Booking')
const mongoose = require('mongoose');
const messageService = require('./messageService')
const { getIo } = require('../sockets/socketManager')
const notificationService = require('./notificationService')
const technicianService = require('./technicianService')
const userService = require('./userService')
const createWarranty = async (warrantyData, session = null) => {
    const options = session ? { session } : {};
    const newWarranty = new BookingWarranty(warrantyData);
    return await newWarranty.save(options);
};

const requestWarranty = async (bookingId, reportedIssue) => {
    const io = getIo()
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            throw new Error('ID đặt lịch không hợp lệ');
        }
        const booking = await Booking.findByIdAndUpdate(
            bookingId,
            {
                $set: {
                    isChatAllowed: true,
                    isVideoCallAllowed: true,
                },
            },
            { new: true }
        ).populate('technicianId');
        const requestDate = new Date();
        const expireAt = new Date(requestDate);
        expireAt.setDate(requestDate.getDate() + 1);
        const bookingWarranty = await createWarranty({
            bookingId,
            customerId: booking.customerId,
            technicianId: booking.technicianId._id,
            requestDate,
            reportedIssue: reportedIssue || 'Khách hàng yêu cầu bảo hành',
            isUnderWarranty: true,
            status: 'PENDING',
            expireAt
        }, session);

        const messageData = {
            bookingId,
            fromUser: booking.technicianId.userId,
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
            url: `/warranty?bookingWarrantyId=${bookingWarranty._id}`
        };
        const notification = await notificationService.createNotification(notificationData);
        io.to(`user:${notification.userId}`).emit('receiveNotification', notification);
        io.to(`user:${newMessage.fromUser}`).emit('receiveMessage', newMessage);
        io.to(`user:${newMessage.toUser}`).emit('receiveMessage', newMessage);
        await session.commitTransaction();
        session.endSession();
        return bookingWarranty
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.log(error);

        throw error

    }
}

const getWarrantyById = async (bookingWarrantyId) => {
    try {

        if (!mongoose.Types.ObjectId.isValid(bookingWarrantyId)) {
            throw new Error('ID bảo hành không hợp lệ');
        }
        const warranty = await BookingWarranty.findById(bookingWarrantyId)
            .populate('customerId') // populate customerId
            .populate({
                path: 'bookingId',
                populate: {
                    path: 'serviceId'
                }
            })
            .populate({
                path: 'technicianId',
                populate: {
                    path: 'userId', // populate userId nằm trong technicianId
                }
            });

        if (!warranty) {
            throw new Error('Không tìm thấy bảo hành');
        }
        return warranty;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

const updateWarrantyById = async (bookingWarrantyId, formData) => {
    try {
        const { status, rejectionReason, solutionNote } = formData;
        const io = getIo();


        const updateData = { status };
        if (rejectionReason) {
            updateData.rejectionReason = rejectionReason;
        }
        if (solutionNote) {
            updateData.solutionNote = solutionNote;

        }

        const updatedWarranty = await BookingWarranty.findByIdAndUpdate(
            bookingWarrantyId,
            updateData,
            { new: true } // Return the updated document
        )

        if (!updatedWarranty) {
            throw new Error('BookingWarranty not found');
        }
        const customer = await userService.findUserById(updatedWarranty.customerId)
        const technician = await technicianService.getTechnicianProfile(updatedWarranty.technicianId)
        const customerId = customer._id?.toString();
        const technicianId = technician._id?.toString();
        if (customerId) {
            io.to(`user:${customerId}`).emit('warrantyUpdated', {
                bookingWarrantyId,
                status: updatedWarranty.status // Add this line
            });
        }
        if (technicianId) {
            io.to(`user:${technicianId}`).emit('warrantyUpdated', {
                bookingWarrantyId,
                status: updatedWarranty.status // Add this line
            });
        }
        return updatedWarranty;
    } catch (error) {
        console.error('Error updating warranty status:', error.message);
        throw error;
    }
};

module.exports = {
    requestWarranty,
    getWarrantyById,
    updateWarrantyById
};