const BookingWarranty = require('../models/BookingWarranty')
const Booking = require('../models/Booking')
const mongoose = require('mongoose');
const messageService = require('./messageService')
const { getIo } = require('../sockets/socketManager')
const notificationService = require('./notificationService')
const technicianService = require('./technicianService')
const userService = require('./userService')
const Role = require('../models/Role')
const User = require('../models/User')
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
        const booking = await Booking.findById(
            bookingId
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
        const addedWarranty = await bookingWarranty.populate([
            { path: 'technicianId', populate: { path: 'userId' } },
            { path: 'customerId' }
        ]);


        const notificationData = {
            userId: addedWarranty.technicianId.userId._id,
            title: `Đơn bảo hành`,
            content: `Bạn nhận được 1 dơn bảo hành từ đơn ${booking.bookingCode}.`,
            type: 'NEW_REQUEST',
            referenceId: addedWarranty._id,
            referenceModel: 'BookingWarranty',
            url: `/warranty?bookingWarrantyId=${addedWarranty._id}`
        };
        const notification = await notificationService.createNotification(notificationData);
        io.to(`user:${notification.userId}`).emit('receiveNotification', notification);

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
        const existingWarranty = await BookingWarranty.findById(bookingWarrantyId)
            .populate({
                path: 'technicianId',
                populate: {
                    path: 'userId',
                }
            });
        if (!existingWarranty) {
            throw new Error('Không tìm thấy bảo hành');
        }
        const updateData = { status };
        if (status === 'CONFIRMED') {
            const booking = await Booking.findByIdAndUpdate(
                existingWarranty.bookingId,
                {
                    $set: {
                        isChatAllowed: true,
                        isVideoCallAllowed: true,
                    },
                },
                { new: true }
            ).populate('technicianId');
            const messageData = {
                bookingId: booking._id,
                bookingWarrantyId: existingWarranty._id,
                fromUser: existingWarranty.technicianId.userId._id,
                toUser: existingWarranty.customerId,
                content: 'Bạn đang gặp sự cố gì có thể nói cho tôi biết!',
                type: 'SUPPORT',
            }
            const notificationData = {
                userId: existingWarranty.customerId,
                title: `Đơn bảo hành`,
                content: `Đơn bảo hành từ đơn ${booking.bookingCode} đã được chấp nhận.`,
                type: 'NEW_REQUEST',
                referenceId: existingWarranty._id,
                referenceModel: 'BookingWarranty',
                url: `/warranty?bookingWarrantyId=${existingWarranty._id}`
            };
            const notification = await notificationService.createNotification(notificationData);
            io.to(`user:${notification.userId}`).emit('receiveNotification', notification);
            const newMessage = await messageService.createMessage(messageData)
            io.to(`user:${newMessage.fromUser}`).emit('receiveMessage', newMessage);
            io.to(`user:${newMessage.toUser}`).emit('receiveMessage', newMessage);
        }
      
        if (rejectionReason) {
            updateData.rejectionReason = rejectionReason;
            const adminRole = await Role.findOne({ name: 'ADMIN' });
            if (!adminRole) {
                throw new Error('Admin role not found');
            }
            const admins = await User.find({ role: adminRole._id, status: 'ACTIVE' });
            for (const admin of admins) {
                const adminNotificationData = {
                    userId: admin._id,
                    title: 'Bảo hành từ chối',
                    content: `Thợ ${existingWarranty.technicianId.userId.fullName} đã không xử lý bảo hành đơn ${warranty.bookingId.bookingCode}.`,
                    referenceId: existingWarranty._id,
                    referenceModel: 'BookingWarranty',
                    type: 'NEW_REQUEST',
                    // url: 'warranty'
                };
                await notificationService.createAndSend(adminNotificationData, session);

            }
            const notifyData = {
                userId: existingWarranty.customerId,
                title: 'Bảo hành từ chối',
                content: `Thợ ${existingWarranty.technicianId.userId.fullName} đã không xử lý bảo hành đơn ${warranty.bookingId.bookingCode}.`,
                referenceId: existingWarranty._id,
                referenceModel: 'BookingWarranty',
                type: 'NEW_REQUEST',
                // url: 'warranty'
            };
            await notificationService.createAndSend(notifyData, session);
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

const requestWarrantyForDenialOrCancelation = async (bookingId, technicianId) => {
    const io = getIo()
    const session = await mongoose.startSession();
    try {
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            throw new Error('ID đặt lịch không hợp lệ');
        }
        if (!mongoose.Types.ObjectId.isValid(technicianId)) {
            throw new Error('ID thợ không hợp lệ');
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
            technicianId: technicianId,
            requestDate,
            reportedIssue: reportedIssue || 'Khách hàng yêu cầu bảo hành',
            isUnderWarranty: true,
            status: 'PENDING',
            expireAt
        }, session);
    } catch (error) {
        console.error('Error updating warranty status:', error.message);
        throw error;
    }
}

module.exports = {
    requestWarranty,
    getWarrantyById,
    updateWarrantyById
};