const BookingWarranty = require('../models/BookingWarranty')
const Booking = require('../models/Booking')
const TechnicianSchedule = require('../models/TechnicianSchedule')

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

const requestWarranty = async (bookingId, reportedIssue, images) => {
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
            isUnderWarranty: false,
            status: 'PENDING',
            expireAt,
            images
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
    const session = await mongoose.startSession();
    const io = getIo();
    session.startTransaction();
    try {
        const { status, rejectedReason, solutionNote } = formData;
        const existingWarranty = await BookingWarranty.findById(bookingWarrantyId)
            .populate({
                path: 'technicianId',
                populate: {
                    path: 'userId',
                }
            })
            .populate('bookingId')
        if (!existingWarranty) {
            throw new Error('Không tìm thấy bảo hành');
        }
        const updateData = { status };

        if (status === 'CONFIRMED') {
            const booking = await Booking.findByIdAndUpdate(
                existingWarranty.bookingId._id,
                {
                    $set: {
                        isChatAllowed: true,
                        isVideoCallAllowed: true,
                    },
                },
                { new: true }
            ).populate('technicianId');

            updateData.isUnderWarranty = true;
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


        }

        if (rejectedReason) {
            updateData.rejectedReason = rejectedReason;
            const booking = await Booking.findByIdAndUpdate(
                existingWarranty.bookingId._id,
                {
                    $set: {
                        isChatAllowed: false,
                        isVideoCallAllowed: false,
                    },
                },
                { new: true }
            )
            const adminRole = await Role.findOne({ name: 'ADMIN' });
            if (!adminRole) {
                throw new Error('Admin role not found');
            }
            const admins = await User.find({ role: adminRole._id, status: 'ACTIVE' });
            for (const admin of admins) {
                const adminNotificationData = {
                    userId: admin._id,
                    title: 'Bảo hành từ chối',
                    content: `Thợ ${existingWarranty.technicianId.userId.fullName} đã không xử lý bảo hành đơn ${existingWarranty.bookingId.bookingCode}.`,
                    referenceId: existingWarranty._id,
                    referenceModel: 'BookingWarranty',
                    type: 'NEW_REQUEST',
                    // url: 'warranty'
                };
                const notificationAdmin = await notificationService.createNotification(adminNotificationData, session);
                io.to(`user:${notificationAdmin.userId}`).emit('receiveNotification', notificationAdmin);

            }
            const notifyData = {
                userId: existingWarranty.customerId,
                title: 'Bảo hành từ chối',
                content: `Thợ ${existingWarranty.technicianId.userId.fullName} đã không xử lý bảo hành đơn ${existingWarranty.bookingId.bookingCode}.`,
                referenceId: existingWarranty._id,
                referenceModel: 'BookingWarranty',
                type: 'NEW_REQUEST',
                // url: 'warranty'
            };
            const notificationUser = await notificationService.createNotification(notifyData, session);
            io.to(`user:${notificationUser.userId}`).emit('receiveNotification', notificationUser);

        }
        if (solutionNote) {
            updateData.solutionNote = solutionNote;
            const booking = await Booking.findByIdAndUpdate(
                existingWarranty.bookingId._id,
                {
                    $set: {
                        isChatAllowed: false,
                        isVideoCallAllowed: false,
                    },
                },
                { new: true }
            ).populate('technicianId');
            updateData.isUnderWarranty = false
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
        const technicianId = technician?.userId._id?.toString();
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
        await session.commitTransaction();
        session.endSession();
        return updatedWarranty;
    } catch (error) {
        console.error('Error updating warranty status:', error.message);
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};



const requestWarrantyDate = async (bookingWarrantyId, dateTime) => {
    const io = getIo();
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        if (!mongoose.Types.ObjectId.isValid(bookingWarrantyId)) {
            throw new Error('ID bảo hành không hợp lệ');
        }

        const warranty = await BookingWarranty.findById(bookingWarrantyId)
            .populate({
                path: 'technicianId',
                populate: { path: 'userId' }
            });

        if (!warranty) {
            throw new Error('Không tìm thấy yêu cầu bảo hành');
        }

        warranty.proposedSchedule = dateTime;
        await warranty.save({ session });

        // Gửi thông báo cho thợ
        const notifyData = {
            userId: warranty.technicianId.userId._id,
            title: 'Khách đề xuất lịch bảo hành',
            content: `Khách hàng đã đề xuất lịch hẹn cho đơn bảo hành.`,
            referenceId: warranty._id,
            referenceModel: 'BookingWarranty',
            type: 'NEW_REQUEST',
            url: `/warranty?bookingWarrantyId=${warranty._id}`
        };
        const notification = await notificationService.createNotification(notifyData, session);
        io.to(`user:${notifyData.userId}`).emit('receiveNotification', notification);
        const customerId = warranty.customerId.toString();
        const technicianId = warranty.technicianId?.userId._id?.toString();
        if (customerId) {
            io.to(`user:${customerId}`).emit('warrantyUpdated', {
                bookingWarrantyId,
                status: warranty.status // Add this line 
            });
        }
        if (technicianId) {
            io.to(`user:${technicianId}`).emit('warrantyUpdated', {
                bookingWarrantyId,
                status: warranty.status // Add this line
            });
        }
        await session.commitTransaction();
        session.endSession();

        return warranty;
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error requesting warranty date:', error.message);
        throw error;
    }
};

const confirmWarrantySchedule = async (bookingWarrantyId,startTime, expectedEndTime) => {
    const io = getIo();
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        if (!mongoose.Types.ObjectId.isValid(bookingWarrantyId)) {
            throw new Error('ID bảo hành không hợp lệ');
        }

        const warranty = await BookingWarranty.findById(bookingWarrantyId)
            .populate({
                path: 'customerId'
            });

        if (!warranty) {
            throw new Error('Không tìm thấy yêu cầu bảo hành');
        }
        warranty.confirmedSchedule = { startTime, expectedEndTime };
        await warranty.save({ session });
        const technicianSchedule = new TechnicianSchedule({
            technicianId: warranty.technicianId,
            scheduleType: 'WARRANTY', // Set to 'WARRANTY' to indicate warranty schedule
            startTime,
            endTime: expectedEndTime,
            note: `Lịch bảo hành cho yêu cầu ${warranty._id}`
        });
        await technicianSchedule.save({ session });
        const notifyData = {
            userId: warranty.customerId._id,
            title: 'Thợ đã xác nhận lịch bảo hành',
            content: `Thợ đã xác nhận lịch bảo hành cho đơn từ lịch đặt dịch vụ.`,
            referenceId: warranty._id,
            referenceModel: 'BookingWarranty',
            type: 'NEW_REQUEST',
            url: `/warranty?bookingWarrantyId=${warranty._id}`
        };
        const notification = await notificationService.createNotification(notifyData, session);
        io.to(`user:${notifyData.userId}`).emit('receiveNotification', notification);
        const customerId = warranty.customerId._id.toString();
        const technicianId = warranty.technicianId.toString();
        if (customerId) {
            io.to(`user:${customerId}`).emit('warrantyUpdated', {
                bookingWarrantyId,
                status: warranty.status // Add this line 
            });
        }
        if (technicianId) {
            io.to(`user:${technicianId}`).emit('warrantyUpdated', {
                bookingWarrantyId,
                status: warranty.status // Add this line
            });
        }
        await session.commitTransaction();
        session.endSession();

        return warranty;
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error confirming warranty schedule:', error.message);
        throw error;
    }
};

module.exports = {
    requestWarranty,
    getWarrantyById,
    updateWarrantyById,
    requestWarrantyDate,
    confirmWarrantySchedule
};