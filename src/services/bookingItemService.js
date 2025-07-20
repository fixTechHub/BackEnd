const mongoose = require('mongoose');
const Booking = require("../models/Booking");
const BookingItem = require("../models/BookingItem");
const BookingPrice = require("../models/BookingPrice");
const notificationService = require("./notificationService");
const Technician = require('../models/Technician');
const BookingPriceLog = require('../models/BookingPriceLog');
const BookingItemLog = require('../models/BookingItemLog');

const proposeAdditionalItems = async (bookingId, userId, items, reason) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const technicianId = await Technician.findOne({ userId: userId }).select('_id').lean();
        // console.log('--- TECHNICIAN ID ---', technicianId);

        // Kiểm tra booking có tồn tại và đang ở trạng thái IN_PROGRESS
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            throw new Error('Không tìm thấy booking');
        }

        if (booking.status !== 'IN_PROGRESS') {
            throw new Error('Booking phải ở trạng thái đang thực hiện');
        }

        if (booking.technicianId.toString() !== technicianId._id.toString()) {
            throw new Error('Bạn không phải kỹ thuật viên được phân công cho booking này');
        }

        // Lấy booking price đã được accept
        const bookingPrice = await BookingPrice.findOne({
            bookingId,
            technicianId,
            status: 'ACCEPTED'
        });

        if (!bookingPrice) {
            throw new Error('Không tìm thấy báo giá đã được chấp nhận');
        }

        // Tạo các additional items
        const additionalItems = [];
        let totalAmount = 0;

        for (const item of items) {
            const newItem = new BookingItem({
                bookingPriceId: bookingPrice._id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                note: item.note,
                status: 'EXTRA',
                isApprovedByCustomer: false
            });

            additionalItems.push(newItem);
            totalAmount += item.price * item.quantity;
        }

        const savedItems = await BookingItem.insertMany(additionalItems, { session });

        // Tạo logs cho từng item được tạo
        const itemLogs = savedItems.map(item => ({
            bookingItemId: item._id,
            version: 1,
            action: 'CREATED',
            data: {
                createdItem: {
                    name: item.name,
                    description: item.description,
                    price: item.price,
                    quantity: item.quantity,
                    note: item.note,
                    status: item.status,
                    isApprovedByCustomer: item.isApprovedByCustomer
                },
            },
            updatedBy: technicianId,
            updatedAt: new Date()
        }));

        await BookingItemLog.insertMany(itemLogs, { session });

        // Gửi thông báo cho khách hàng
        const notificationData = {
            userId: booking.customerId,
            title: 'Có chi phí phát sinh mới',
            content: `Kỹ thuật viên đã đề xuất thêm ${items.length} chi phí phát sinh với tổng số tiền ${totalAmount.toLocaleString('vi-VN')} VNĐ. Vui lòng xem xét và xác nhận.`,
            referenceModel: 'Booking',
            referenceId: booking._id,
            url: `booking/${booking._id}/additional-items`,
            type: 'NEW_REQUEST'
        };

        const notification = await notificationService.createNotification(notificationData);

        await session.commitTransaction();
        session.endSession();

        return {
            items: additionalItems,
            reason,
            totalAmount,
            notification
        };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

const getAdditionalItemsByBooking = async (bookingId, userId, role) => {
    try {
        const technicianId = await Technician.findOne({ userId: userId }).select('_id').lean();
        // Kiểm tra booking có tồn tại
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            throw new Error('Không tìm thấy booking');
        }

        // Kiểm tra quyền truy cập
        if (role === 'CUSTOMER' && booking.customerId.toString() !== userId.toString()) {
            throw new Error('Bạn không có quyền xem booking này');
        }
        if (role === 'TECHNICIAN' && booking.technicianId?.toString() !== technicianId._id.toString()) {
            throw new Error('Bạn không có quyền xem booking này');
        }

        // Lấy booking price đã được accept
        const bookingPrice = await BookingPrice.findOne({
            bookingId,
            status: 'ACCEPTED'
        });

        if (!bookingPrice) {
            throw new Error('Không tìm thấy báo giá đã được chấp nhận');
        }

        // Lấy tất cả additional items
        const additionalItems = await BookingItem.find({
            bookingPriceId: bookingPrice._id,
            status: 'EXTRA'
        }).sort({ createdAt: -1 });

        // Tính tổng số tiền
        const totalAmount = additionalItems.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
        }, 0);

        // Phân loại items theo trạng thái
        const pendingItems = additionalItems.filter(item => !item.isApprovedByCustomer);
        const approvedItems = additionalItems.filter(item => item.isApprovedByCustomer);

        return {
            items: additionalItems,
            pendingItems,
            approvedItems,
            totalAmount,
            pendingAmount: pendingItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            approvedAmount: approvedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            hasPendingItems: pendingItems.length > 0
        };
    } catch (error) {
        throw error;
    }
};

const approveAdditionalItems = async (bookingId, customerId, reason) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Kiểm tra booking
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            throw new Error('Không tìm thấy booking');
        }

        if (booking.customerId.toString() !== customerId.toString()) {
            throw new Error('Bạn không có quyền thực hiện hành động này');
        }

        if (booking.status !== 'IN_PROGRESS') {
            throw new Error('Booking phải ở trạng thái đang thực hiện');
        }

        // Lấy booking price
        const bookingPrice = await BookingPrice.findOne({
            bookingId,
            status: 'ACCEPTED'
        });

        if (!bookingPrice) {
            throw new Error('Không tìm thấy báo giá đã được chấp nhận');
        }

        // Lấy tất cả pending additional items
        const pendingItems = await BookingItem.find({
            bookingPriceId: bookingPrice._id,
            status: 'EXTRA',
            isApprovedByCustomer: false
        });

        if (pendingItems.length === 0) {
            throw new Error('Không có chi phí phát sinh nào đang chờ xác nhận');
        }

        // Tính tổng tiền additional items
        const additionalItemsTotal = pendingItems.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
        }, 0);

        // Tạo logs cho từng item trước khi cập nhật
        const itemLogs = pendingItems.map( item => ({
            bookingItemId: item._id,
            action: 'UPDATED',
            data: {
                oldData: {
                    isApprovedByCustomer: false,
                    updatedAt: item.updatedAt
                },
                newData: {
                    isApprovedByCustomer: true,
                    updatedAt: new Date()
                },
                changeReason: 'Khách hàng đã xác nhận chi phí phát sinh',
            },
            updatedBy: customerId,
            updatedAt: new Date()
        }));

        // Lưu logs cho tất cả items
        await BookingItemLog.insertMany(itemLogs, { session });

        // Cập nhật trạng thái tất cả pending items
        await BookingItem.updateMany(
            {
                bookingPriceId: bookingPrice._id,
                status: 'EXTRA',
                isApprovedByCustomer: false
            },
            {
                $set: {
                    isApprovedByCustomer: true
                }
            },
            { session }
        );

        // Lưu log trước khi cập nhật
        await BookingPriceLog.create([{
            bookingId: booking._id,
            technicianId: bookingPrice.technicianId,
            priceVersion: await getNextPriceVersion(bookingPrice._id),
            data: {
                oldFinalPrice: bookingPrice.finalPrice,
                newFinalPrice: bookingPrice.finalPrice + additionalItemsTotal,
                additionalItems: pendingItems,
                approvedItemsCount: pendingItems.length
            },
            status: 'UPDATED',
            extraReason: reason,
            createdAt: new Date()
        }], { session });

        // Cập nhật trực tiếp vào BookingPrice
        await BookingPrice.findByIdAndUpdate(
            bookingPrice._id,
            {
                $inc: { finalPrice: additionalItemsTotal },
                extraReason: reason || 'Khách hàng đã xác nhận tất cả chi phí phát sinh'
            },
            { session }
        );

        const notificationData = {
            userId: booking.technicianId,
            title: 'Khách hàng đã xác nhận chi phí phát sinh',
            content: `Khách hàng đã xác nhận ${pendingItems.length} chi phí phát sinh với tổng số tiền ${additionalItemsTotal.toLocaleString('vi-VN')} VNĐ.`,
            referenceModel: 'Booking',
            referenceId: booking._id,
            url: `technician/booking/${booking._id}`,
            type: 'NEW_REQUEST'
        };

        const notification = await notificationService.createNotification(notificationData);

        await session.commitTransaction();
        session.endSession();

        return {
            approvedItems: pendingItems,
            additionalItemsTotal,
            newFinalPrice: bookingPrice.finalPrice + additionalItemsTotal,
            itemLogs: itemLogs.length,
            notification
        };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

const rejectAllAdditionalItems = async (bookingId, customerId, reason) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Kiểm tra booking
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            throw new Error('Không tìm thấy booking');
        }

        if (booking.customerId.toString() !== customerId.toString()) {
            throw new Error('Bạn không có quyền thực hiện hành động này');
        }

        if (booking.status !== 'IN_PROGRESS') {
            throw new Error('Booking phải ở trạng thái đang thực hiện');
        }

        // Lấy booking price
        const bookingPrice = await BookingPrice.findOne({
            bookingId,
            status: 'ACCEPTED'
        });

        if (!bookingPrice) {
            throw new Error('Không tìm thấy báo giá đã được chấp nhận');
        }

        // Lấy tất cả pending additional items
        const pendingItems = await BookingItem.find({
            bookingPriceId: bookingPrice._id,
            status: 'EXTRA',
            isApprovedByCustomer: false
        });

        if (pendingItems.length === 0) {
            throw new Error('Không có chi phí phát sinh nào đang chờ xác nhận');
        }

        // Tạo logs cho từng item trước khi xóa
        const itemLogs = pendingItems.map(item => ({
            bookingItemId: item._id,
            action: 'DELETED',
            data: {
                deletedItem: {
                    name: item.name,
                    description: item.description,
                    price: item.price,
                    quantity: item.quantity,
                    note: item.note,
                    status: item.status,
                    isApprovedByCustomer: item.isApprovedByCustomer,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt
                },
                deleteReason: 'Khách hàng đã từ chối chi phí phát sinh',
            },
            updatedBy: customerId,
            updatedAt: new Date()
        }));

        // Lưu logs cho tất cả items
        await BookingItemLog.insertMany(itemLogs, { session });

        // Xóa tất cả pending items
        const result = await BookingItem.deleteMany(
            {
                bookingPriceId: bookingPrice._id,
                status: 'EXTRA',
                isApprovedByCustomer: false
            },
            { session }
        );

        // Gửi thông báo cho kỹ thuật viên
        const notificationData = {
            userId: booking.technicianId,
            title: 'Khách hàng đã từ chối tất cả chi phí phát sinh',
            content: `Khách hàng đã từ chối tất cả ${result.deletedCount} chi phí phát sinh.}`,
            referenceModel: 'Booking',
            referenceId: booking._id,
            url: `technician/booking/${booking._id}`,
            type: 'NEW_REQUEST'
        };

        const notification = await notificationService.createNotification(notificationData);

        await session.commitTransaction();
        session.endSession();

        return {
            deletedCount: result.deletedCount,
            itemLogs: itemLogs.length,
            notification
        };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

// Helper function để lấy version tiếp theo cho BookingPrice
const getNextPriceVersion = async (bookingPriceId) => {
    const lastLog = await BookingPriceLog.findOne({
        bookingPriceId
    }).sort({ priceVersion: -1 });

    return lastLog ? lastLog.priceVersion + 1 : 1;
};

module.exports = {
    proposeAdditionalItems,
    getAdditionalItemsByBooking,
    approveAdditionalItems,
    rejectAllAdditionalItems
};
