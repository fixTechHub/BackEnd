const technicianService = require('../services/technicianService');
const User = require('../models/User');
const Technician = require('../models/Technician');

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
        const userId = req.user.userId;
        const role = req.user.role; 

        const booking = await technicianService.confirmJobDoneByTechnician(
            bookingId,
            userId,
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

const getTechnicianInformation = async (req, res) => {
    try {
        const technicianId = req.params.technicianId;

        const technician = await technicianService.getTechnicianInformation(technicianId);
        console.log('--- TECHNICIAN ---', technician);
        
        res.status(200).json({
            message: 'Lấy thông tin thợ thành công',
            data: technician
        });
    } catch (error) {
        
    }
};

module.exports = {
    sendQuotation,
    confirmJobDoneByTechnician,
    getTechnicianInformation
};