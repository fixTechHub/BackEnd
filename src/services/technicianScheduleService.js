const mongoose = require('mongoose');
const TechnicianSchedule = require('../models/TechnicianSchedule');

/**
 * Tạo lịch hẹn cho technician
 * @param {Object} scheduleData - Dữ liệu lịch hẹn
 * @param {ObjectId} scheduleData.technicianId - ID của technician
 * @param {ObjectId} scheduleData.bookingId - ID của booking (nếu có)
 * @param {String} scheduleData.scheduleType - Loại lịch hẹn (BOOKING, WARRANTY)
 * @param {Date} scheduleData.startTime - Thời gian bắt đầu
 * @param {Date} scheduleData.endTime - Thời gian kết thúc
 * @param {String} scheduleData.note - Ghi chú
 * @param {Object} session - MongoDB session
 * @returns {Promise<Object>} - TechnicianSchedule object
 */
const createTechnicianSchedule = async (scheduleData, session = null) => {
    try {
        const technicianSchedule = new TechnicianSchedule({
            technicianId: scheduleData.technicianId,
            bookingId: scheduleData.bookingId || null,
            bookingWarrantyId: scheduleData.bookingWarrantyId || null,
            scheduleStatus: 'UNAVAILABLE',
            scheduleType: scheduleData.scheduleType || 'BOOKING',
            startTime: scheduleData.startTime,
            endTime: scheduleData.endTime || null,
            note: scheduleData.note || null
        });

        if (session) {
            await technicianSchedule.save({ session });
        } else {
            await technicianSchedule.save();
        }

        return technicianSchedule;
    } catch (error) {
        console.error('Error creating technician schedule:', error);
        throw error;
    }
};

/**
 * Tạo lịch hẹn cho booking scheduled
 * @param {Object} bookingData - Dữ liệu booking
 * @param {ObjectId} bookingData._id - ID của booking
 * @param {ObjectId} bookingData.technicianId - ID của technician (nếu đã assign)
 * @param {Object} bookingData.schedule - Thông tin lịch hẹn
 * @param {Date} bookingData.schedule.startTime - Thời gian bắt đầu
 * @param {Date} bookingData.schedule.expectedEndTime - Thời gian kết thúc dự kiến
 * @param {Object} session - MongoDB session
 * @returns {Promise<Object>} - TechnicianSchedule object
 */
const createScheduleForBooking = async (bookingData, session = null) => {
    try {
        // Chỉ tạo schedule nếu có technicianId (đã assign thợ)
        if (!bookingData.technicianId) {
            console.log('Booking chưa có technicianId, không tạo schedule');
            return null;
        }

        // Kiểm tra xem booking có phải là scheduled type không
        if (bookingData.isUrgent === true) {
            console.log('Booking là urgent type, không tạo schedule');
            return null;
        }

        // Kiểm tra xem có thông tin schedule không
        if (!bookingData.schedule || !bookingData.schedule.startTime || !bookingData.schedule.expectedEndTime) {
            console.log('Booking không có thông tin schedule đầy đủ');
            return null;
        }

        // Kiểm tra xem thời gian có hợp lệ không
        const startTime = new Date(bookingData.schedule.startTime);
        const endTime = new Date(bookingData.schedule.expectedEndTime);
        
        if (startTime >= endTime) {
            console.log('Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc');
            return null;
        }

        const scheduleData = {
            technicianId: bookingData.technicianId,
            bookingId: bookingData._id,
            scheduleType: 'BOOKING',
            startTime: startTime,
            endTime: endTime,
            note: `Booking: ${bookingData.bookingCode || bookingData._id}`
        };

        const technicianSchedule = await createTechnicianSchedule(scheduleData, session);
        console.log('Đã tạo TechnicianSchedule cho booking:', bookingData._id);
        
        return technicianSchedule;
    } catch (error) {
        console.error('Error creating schedule for booking:', error);
        throw error;
    }
};

/**
 * Xóa lịch hẹn theo bookingId
 * @param {ObjectId} bookingId - ID của booking
 * @param {Object} session - MongoDB session
 * @returns {Promise<Object>} - Kết quả xóa
 */
const deleteScheduleByBookingId = async (bookingId, session = null) => {
    try {
        const query = { bookingId, scheduleType: 'BOOKING' };
        if (session) {
            return await TechnicianSchedule.deleteMany(query, { session });
        } else {
            return await TechnicianSchedule.deleteMany(query);
        }
    } catch (error) {
        console.error('Error deleting schedule by bookingId:', error);
        throw error;
    }
};

/**
 * Lấy lịch hẹn theo technicianId và khoảng thời gian
 * @param {ObjectId} technicianId - ID của technician
 * @param {Date} startTime - Thời gian bắt đầu
 * @param {Date} endTime - Thời gian kết thúc
 * @returns {Promise<Array>} - Danh sách lịch hẹn
 */
const getSchedulesByTechnicianAndTimeRange = async (technicianId, startTime, endTime) => {
    try {
        const schedules = await TechnicianSchedule.find({
            technicianId,
            startTime: { $lt: endTime },
            $or: [
                { endTime: { $gt: startTime } },
                { endTime: null }
            ]
        }).populate('bookingId', 'bookingCode description');

        return schedules;
    } catch (error) {
        console.error('Error getting schedules by technician and time range:', error);
        throw error;
    }
};

module.exports = {
    createTechnicianSchedule,
    createScheduleForBooking,
    deleteScheduleByBookingId,
    getSchedulesByTechnicianAndTimeRange
};
