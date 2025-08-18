const mongoose = require('mongoose');
const TechnicianSchedule = require('../models/TechnicianSchedule');

/**
 * Lấy danh sách lịch trình trùng với thời gian cụ thể
 * @param {string} technicianId - ID của technician
 * @param {string} startTime - Thời gian bắt đầu (ISO string)
 * @param {string} endTime - Thời gian kết thúc (ISO string)
 * @returns {Object} - Kết quả với conflicts và count
 */
const getConflictingSchedules = async (technicianId, startTime, endTime) => {
    try {
        console.log('🔍 DEBUG: getConflictingSchedules service được gọi');
        console.log('  technicianId:', technicianId);
        console.log('  startTime:', startTime);
        console.log('  endTime:', endTime);

        if (!technicianId || !startTime || !endTime) {
            throw new Error('Thiếu thông tin: technicianId, startTime, endTime');
        }

        // Tạo buffer 1 tiếng trước startTime và 1 tiếng sau endTime
        const bufferedStartTime = new Date(new Date(startTime).getTime() - 60 * 60 * 1000); // 1 tiếng trước
        const bufferedEndTime = new Date(new Date(endTime).getTime() + 60 * 60 * 1000); // 1 tiếng sau

        console.log('--- DEBUG CONFLICT DETECTION ---');
        console.log('Original startTime:', new Date(startTime));
        console.log('Original endTime:', new Date(endTime));
        console.log('Buffered startTime:', bufferedStartTime);
        console.log('Buffered endTime:', bufferedEndTime);

        // Logic kiểm tra overlap với buffer
        const conflictingSchedules = await TechnicianSchedule.find({
            technicianId: technicianId,
            scheduleStatus: 'UNAVAILABLE',
            $or: [
                // Lịch trình bắt đầu trong khoảng thời gian có buffer
                {
                    startTime: {
                        $gte: bufferedStartTime,
                        $lt: bufferedEndTime
                    }
                },
                // Lịch trình kết thúc trong khoảng thời gian có buffer
                {
                    endTime: {
                        $gt: bufferedStartTime,
                        $lte: bufferedEndTime
                    }
                },
                // Lịch trình bao trọn khoảng thời gian có buffer
                {
                    startTime: { $lte: bufferedStartTime },
                    endTime: { $gte: bufferedEndTime }
                }
            ]
        }).populate('bookingId', 'bookingCode startTime expectedEndTime');

        console.log('Found conflicting schedules:', conflictingSchedules.length);
        if (conflictingSchedules.length > 0) {
            conflictingSchedules.forEach((schedule, index) => {
                console.log(`Conflict ${index + 1}:`, {
                    startTime: schedule.startTime,
                    endTime: schedule.endTime,
                    bookingCode: schedule.bookingId?.bookingCode
                });
            });
        }

        // Format dữ liệu trả về
        const formattedConflicts = conflictingSchedules.map(schedule => ({
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            bookingCode: schedule.bookingId?.bookingCode || 'Không xác định',
            note: schedule.note || ''
        }));

        return {
            success: true,
            conflicts: formattedConflicts,
            count: formattedConflicts.length
        };

    } catch (error) {
        console.error('❌ DEBUG: Lỗi trong getConflictingSchedules service:', error);
        throw error;
    }
};

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
    getConflictingSchedules,
    createTechnicianSchedule,
    createScheduleForBooking,
    deleteScheduleByBookingId,
    getSchedulesByTechnicianAndTimeRange
};
