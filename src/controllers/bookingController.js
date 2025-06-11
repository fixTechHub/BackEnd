const bookingService = require('../services/bookingService');
const { addressToPoint } = require('../services/geocodingService');

const createBookingRequest = async (req, res) => {
    try {
        // const customerId = req.user.id; 
        const { customerId, serviceId, description, schedule, location } = req.body;
        // console.log('Booking Text Data:', { customerId, serviceId, description, schedule });

        // Chuyển đổi địa chỉ string sang GeoJSON Point bằng Mapbox
        const locationPoint = await addressToPoint(location);

        // Nếu không thể tìm thấy tọa độ, trả về lỗi
        if (!locationPoint) {
            return res.status(400).json({
                success: false,
                message: 'Không thể tìm thấy vị trí từ địa chỉ bạn cung cấp. Vui lòng thử lại với địa chỉ chi tiết hơn.'
            });
        }

        const imageUrls = req.s3FileUrls || [];
        // console.log('Uploaded Image URLs:', imageUrls);

        const bookingData = {
            customerId,
            serviceId,
            location: locationPoint,
            description,
            schedule,
            images: imageUrls,
        };
        // console.log('--- Booking Data ---', bookingData);

        const io = req.app.get('io');

        const result = await bookingService.createRequestAndNotify(bookingData, io);
        // console.log('Booking Request Result:', result);

        res.status(201).json({
            success: true,
            message: 'Tạo yêu cầu thành công. Hệ thống đang tìm kiếm kỹ thuật viên phù hợp.',
            data: result.booking,
            technicians_found: result.technicians.data.length > 0 ? result.technicians.data : result.message
        });
    } catch (error) {
        console.error('Create Booking Request Error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};


const getBookingById = async (req, res) => {
    try {
        const bookingId = req.params.id;

        const booking = await bookingService.getBookingById(bookingId);

        res.status(200).json({
            success: true,
            message: 'Lấy thông tin đặt lịch thành công!',
            data: booking
        });
    } catch (error) {
        console.error('Create Booking Request Error:', error);
        res.status(400).json({
            success: false,
            message: 'Lấy thông tin đặt lịch thất bại.',
            error: error.message
        });
    }
};

module.exports = {
    createBookingRequest,
    getBookingById
};