const technicianScheduleService = require('../services/technicianScheduleService');
const Technician = require('../models/Technician');

/**
 * Lấy danh sách lịch trình trùng với thời gian cụ thể
 * Route: GET /api/technician-schedules/conflicts
 */
const getConflictingSchedules = async (req, res) => {
    try {
        console.log('🚀 DEBUG: getConflictingSchedules controller được gọi');
        console.log('  req.query:', req.query);
        
        const { technicianId, startTime, endTime } = req.query;
        
        if (!technicianId || !startTime || !endTime) {
            console.log('❌ DEBUG: Thiếu thông tin:', { technicianId, startTime, endTime });
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin: technicianId, startTime, endTime'
            });
        }

        // Lấy technician từ userId
        const technician = await Technician.findOne({ userId: technicianId });
        if (!technician) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy kỹ thuật viên'
            });
        }

        // Gọi service để xử lý business logic
        const result = await technicianScheduleService.getConflictingSchedules(
            technician._id, 
            startTime, 
            endTime
        );

        // Trả về kết quả từ service
        res.json(result);

    } catch (error) {
        console.error('❌ DEBUG: Lỗi trong controller getConflictingSchedules:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy lịch trùng',
            error: error.message
        });
    }
};

module.exports = {
    getConflictingSchedules
};
