const bookingService = require('../services/bookingService');
const { addressToPoint } = require('../services/geocodingService');

const createBookingRequest = async (req, res) => {
    try {
        // const customerId = req.user.id; 
        const { customerId, serviceId, description, schedule, address } = req.body;
        // console.log('Booking Text Data:', { customerId, serviceId, description, schedule });
        console.log(address);

        // Chuyển đổi địa chỉ string sang GeoJSON Point bằng Mapbox
        const locationPoint = await addressToPoint(address);

        // Nếu không thể tìm thấy tọa độ, trả về lỗi
        if (!locationPoint) {
            return res.status(400).json({
                success: false,
                message: 'Không thể tìm thấy vị trí từ địa chỉ bạn cung cấp. Vui lòng thử lại với địa chỉ chi tiết hơn.'
            });
        }

        const location = {
            address: address,
            geojson: locationPoint,
        }
        console.log('--- LOCATION ---', location);

        const imageUrls = req.s3FileUrls || [];
        // console.log('Uploaded Image URLs:', imageUrls);

        const bookingData = {
            customerId,
            serviceId,
            location,
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

const cancelBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { reason } = req.body;
        const userId = req.user._id;
        const role = req.user.role.name;

        if (!reason) {
            return res.status(400).json({
                message: 'Vui lòng cung cấp lý do hủy booking'
            });
        }

        const booking = await bookingService.cancelBooking(
            bookingId,
            userId,
            role,
            reason
        );

        res.status(200).json({
            message: 'Hủy booking thành công',
            data: booking
        });
    } catch (error) {
        console.error('Lỗi khi hủy booking:', error);
        res.status(error.message.includes('quyền') ? 403 : 500).json({
            message: error.message || 'Không thể hủy booking'
        });
    }
};

module.exports = {
    createBookingRequest,
    getBookingById,
    cancelBooking
};