const technicianService = require('../services/technicianService');
const User = require('../models/User');
const Technician = require('../models/Technician');
const { populate } = require('../models/Booking');

const sendQuotation = async (req, res) => {
    try {
        // const technicianId = req.user._id;
        const { bookingId, technicianId, laborPrice, items, warrantiesDuration } = req.body;
        const bookingPriceData = {
            bookingId,
            technicianId,
            laborPrice,
            warrantiesDuration,
            items
        };

        const result = await technicianService.sendQuotation(bookingPriceData);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error sending quotation:', error);
        res.status(500).json({ message: 'Failed to send quotation', error: error.message });
    }
};

const confirmJobDoneByTechnician = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { userId } = req.body;
        // const userId = req.user._id;
        // const role = req.user.role.name;
        const technician = await Technician.findOne({ userId: userId }).populate({path: 'userId', populate: {path: 'role', model: require('../models/Role')}});
        console.log(technician)
        const role = technician.userId.role.name; 

        const booking = await technicianService.confirmJobDoneByTechnician(
            bookingId,
            technician._id,
            role
        );

        res.status(200).json({
            message: 'Xác nhận thành công',
            data: booking
        });
    } catch (error) {
        console.error('Lỗi khi xác nhận hoàn thành:', error);
        res.json({
            message: error.message || 'Không thể xác nhận hoàn thành'
        });
    }
};

module.exports = {
    sendQuotation,
    confirmJobDoneByTechnician
};