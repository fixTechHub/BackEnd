const mongoose = require('mongoose');
const BookingItemLog = require('../models/BookingItemLog');
const BookingPriceLog = require('../models/BookingPriceLog');
const BookingStatusLog = require('../models/BookingStatusLog');

// Lưu log khi tạo/sửa/xóa booking item
const logBookingItem = async (bookingItemId, action, data, updatedBy) => {
    try {
        // Lấy version mới nhất
        const lastLog = await BookingItemLog.findOne({ bookingItemId })
            .sort({ version: -1 })
            .limit(1);

        const version = lastLog ? lastLog.version + 1 : 1;

        const newLog = new BookingItemLog({
            bookingItemId,
            version,
            action,
            data,
            updatedBy
        });

        await newLog.save();
        return newLog;
    } catch (error) {
        console.error('Lỗi khi lưu log booking item:', error);
        throw error;
    }
};

// Lưu log khi tạo/sửa báo giá
const logBookingPrice = async (bookingId, technicianId, data, status, note = '') => {
    try {
        // Lấy version mới nhất
        const lastLog = await BookingPriceLog.findOne({ bookingId })
            .sort({ priceVersion: -1 })
            .limit(1);

        const priceVersion = lastLog ? lastLog.priceVersion + 1 : 1;

        const newLog = new BookingPriceLog({
            bookingId,
            technicianId,
            priceVersion,
            data,
            status,
            note
        });

        await newLog.save();
        return newLog;
    } catch (error) {
        console.error('Lỗi khi lưu log booking price:', error);
        throw error;
    }
};

// Lưu log khi thay đổi trạng thái booking
const logBookingStatus = async (bookingId, fromStatus, toStatus, changedBy, role, note = '') => {
    try {
        const newLog = new BookingStatusLog({
            bookingId,
            fromStatus,
            toStatus,
            changedBy,
            role,
            note
        });

        await newLog.save();
        return newLog;
    } catch (error) {
        console.error('Lỗi khi lưu log booking status:', error);
        throw error;
    }
};

// Lấy lịch sử thay đổi của một booking item
const getBookingItemLogs = async (bookingItemId) => {
    try {
        const logs = await BookingItemLog.find({ bookingItemId })
            .sort({ version: -1 })
            .populate('updatedBy', 'name email');

        return logs;
    } catch (error) {
        console.error('Lỗi khi lấy log booking item:', error);
        throw error;
    }
};

// Lấy lịch sử thay đổi báo giá của một booking
const getBookingPriceLogs = async (bookingId) => {
    try {
        const logs = await BookingPriceLog.find({ bookingId })
            .sort({ priceVersion: -1 })
            .populate('technicianId', 'userId')
            .populate('technicianId.userId', 'name email');

        return logs;
    } catch (error) {
        console.error('Lỗi khi lấy log booking price:', error);
        throw error;
    }
};

// Lấy lịch sử thay đổi trạng thái của một booking
const getBookingStatusLogs = async (bookingId) => {
    try {
        const logs = await BookingStatusLog.find({ bookingId })
            .sort({ createdAt: -1 })
            .populate('changedBy', 'name email');

        return logs;
    } catch (error) {
        console.error('Lỗi khi lấy log booking status:', error);
        throw error;
    }
};

module.exports = {
    logBookingItem,
    logBookingPrice,
    logBookingStatus,
    getBookingItemLogs,
    getBookingPriceLogs,
    getBookingStatusLogs
}; 