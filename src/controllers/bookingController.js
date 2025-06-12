
const bookingService = require('../services/bookingService');
const { addressToPoint } = require('../services/geocodingService');
const getBookingById = async (req, res) => {
    try {
      const { bookingId } = req.params;
      const booking = await bookingService.getBookingById(bookingId);
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      res.json(booking);
    } catch (error) {
        console.log(error);
        
      res.status(500).json({ error: 'Failed to fetch booking' });
    }
  };
const createBookingRequest = async (req, res) => {
    try {
        // 1. Lấy dữ liệu text
        // const customerId = req.user.id; 
        const { customerId, serviceId, description, schedule, location } = req.body;
        console.log('Booking Text Data:', { customerId, serviceId, description, schedule });

        // Chuyển đổi địa chỉ string sang GeoJSON Point bằng Mapbox
        const locationPoint = await addressToPoint(location);

        // Nếu không thể tìm thấy tọa độ, trả về lỗi
        if (!locationPoint) {
            return res.status(400).json({ 
                success: false, 
                message: 'Không thể tìm thấy vị trí từ địa chỉ bạn cung cấp. Vui lòng thử lại với địa chỉ chi tiết hơn.' 
            });
        }

        // 2. Lấy MẢNG các URL ảnh đã upload từ middleware
        const imageUrls = req.s3FileUrls || [];
        console.log('Uploaded Image URLs:', imageUrls);

        const bookingData = {
            customerId,
            serviceId,
            location: locationPoint,
            description,
            schedule,
            images: imageUrls,
        };
        console.log('Booking Data:', bookingData);

        const io = req.app.get('io');

        const result = await bookingService.createRequestAndNotify(bookingData, customerId, io);
        // console.log('Booking Request Result:', result);

        res.status(201).json({
            success: true,
            message: 'Tạo yêu cầu thành công. Hệ thống đang tìm kiếm kỹ thuật viên phù hợp.',
            data: result.booking
        });
    } catch (error) {
        console.error('Create Booking Request Error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};


const createBooking = async (req, res) => {
    try {
        const customerId = req.user.id;
        const io = req.app.get('io'); // Lấy instance của io từ app

        const newBooking = await bookingService.createBooking(req.body, customerId, io);

        res.status(201).json({
            message: 'Tạo yêu cầu đặt lịch thành công!',
            data: newBooking
        });
    } catch (error) {
        res.status(400).json({ message: 'Tạo yêu cầu thất bại.', error: error.message });
    }
};

module.exports = {
    createBooking,
    createBookingRequest,
    getBookingById
};

