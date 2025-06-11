const technicianService = require('../services/technicianService');

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

module.exports = {
    sendQuotation,
};