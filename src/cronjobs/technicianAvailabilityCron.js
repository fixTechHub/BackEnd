const cron = require('node-cron');
const Technician = require('../models/Technician');
const TechnicianSchedule = require('../models/TechnicianSchedule');

/**
 * CronJob để tự động cập nhật trạng thái thợ thành ONJOB khi đến đúng thời gian lịch trình
 * Chạy mỗi phút để kiểm tra và cập nhật trạng thái
 */
const updateTechnicianAvailabilityFromSchedule = async () => {
    try {
        const currentTime = new Date();
        
        // Lấy tất cả thợ có trạng thái APPROVED và FREE
        const technicians = await Technician.find({ 
            status: 'APPROVED',
            availability: 'FREE'
        });
        
        if (technicians.length === 0) {
            return;
        }
        
        let updatedCount = 0;
        
        for (const technician of technicians) {
            try {
                // Kiểm tra xem thợ có lịch trình UNAVAILABLE bắt đầu từ thời gian hiện tại không
                const currentSchedule = await TechnicianSchedule.findOne({
                    technicianId: technician._id,
                    scheduleStatus: 'UNAVAILABLE',
                    startTime: { 
                        $lte: currentTime,
                        $gte: new Date(currentTime.getTime() - 60000) // Trong vòng 1 phút trước
                    }
                });
                
                if (currentSchedule) {
                    // Thợ có lịch trình bắt đầu từ thời gian hiện tại, chuyển sang ONJOB
                    await Technician.findByIdAndUpdate(technician._id, {
                        availability: 'ONJOB',
                        updatedAt: new Date()
                    });
                    
                    updatedCount++;
                    console.log(`[${currentTime.toISOString()}] Thợ ${technician._id}: FREE → ONJOB (có lịch trình lúc ${currentSchedule.startTime})`);
                }
                
            } catch (error) {
                console.error(`Lỗi khi cập nhật thợ ${technician._id}:`, error.message);
                continue; // Tiếp tục với thợ tiếp theo
            }
        }
        
        if (updatedCount > 0) {
            console.log(`[${currentTime.toISOString()}] Đã cập nhật ${updatedCount} thợ sang ONJOB`);
        }
        
    } catch (error) {
        console.error('Lỗi trong cronJob cập nhật trạng thái thợ:', error.message);
    }
};

// Khởi động cronJob cập nhật trạng thái thợ từ lịch trình (chạy mỗi phút)
cron.schedule('* * * * *', updateTechnicianAvailabilityFromSchedule, {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh"
});

console.log('Technician availability cron job started:');
console.log('- Cập nhật trạng thái thợ thành ONJOB khi đến đúng thời gian lịch trình: mỗi phút');

module.exports = {
    updateTechnicianAvailabilityFromSchedule
};
