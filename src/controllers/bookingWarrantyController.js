const bookingWarrantyService = require("../services/bookingWarrantyService");

const requestBookingWarranty = async (req,res) => {
    try {
        const bookingId = req.body
        const bookingWarranty = await bookingWarrantyService.requestWarranty(bookingId)
        res.status(201).json(bookingWarranty)
    } catch (error) {
        console.error('Lỗi khi yêu cầu bảo hành:', error);

        res.status(500).json({
            error: error.message
        });
    }
}


module.exports = {
  requestBookingWarranty
}; 
