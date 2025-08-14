const bookingLogService = require('../services/bookingLogService');

// Lấy lịch sử thay đổi của một booking item
const getBookingItemLogs = async (req, res) => {
    try {
        const { bookingItemId } = req.params;
        const logs = await bookingLogService.getBookingItemLogs(bookingItemId);
        res.json(logs);
    } catch (error) {
        console.error('Lỗi khi lấy log booking item:', error);
        res.status(500).json({ message: 'Lỗi khi lấy log booking item' });
    }
};

// Lấy lịch sử thay đổi báo giá của một booking
const getBookingPriceLogs = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const logs = await bookingLogService.getBookingPriceLogs(bookingId);
        res.json(logs);
    } catch (error) {
        console.error('Lỗi khi lấy log booking price:', error);
        res.status(500).json({ message: 'Lỗi khi lấy log booking price' });
    }
};

// Lấy lịch sử thay đổi trạng thái của một booking
const getBookingStatusLogs = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const logs = await bookingLogService.getBookingStatusLogs(bookingId);
        res.json(logs);
    } catch (error) {
        console.error('Lỗi khi lấy log booking status:', error);
        res.status(500).json({ message: 'Lỗi khi lấy log booking status' });
    }
};

module.exports = {
    getBookingItemLogs,
    getBookingPriceLogs,
    getBookingStatusLogs
}; 