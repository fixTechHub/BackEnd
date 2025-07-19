const bookingWarrantyService = require("../services/bookingWarrantyService");
const bookingService = require('../services/bookingService')

const requestBookingWarranty = async (req, res) => {
    try {
        const formData = req.body
        const images = req.s3Urls || [];
        const { bookingId, reportedIssue } = formData
        const bookingWarranty = await bookingWarrantyService.requestWarranty(bookingId, reportedIssue, images);
        const booking = await bookingService.getBookingById(bookingId)
        if(booking.status!=='DONE'){
            return res.status(400).json({ error: 'Ban chưa có quyền được phép yêu cầu bảo hành!' });
        }
        
        res.status(201).json(bookingWarranty)
    } catch (error) {
        console.error('Lỗi khi yêu cầu bảo hành:', error);

        res.status(500).json({
            error: error.message
        });
    }
}

const getBookingWarrantyById = async (req, res) => {
    try {
        const {bookingWarrantyId} = req.params
        
        const bookingWarranty = await bookingWarrantyService.getWarrantyById(bookingWarrantyId)
        res.status(201).json(bookingWarranty)
    } catch (error) {
        console.error('Lỗi khi yêu cầu bảo hành:', error);

        res.status(500).json({
            error: error.message
        });
    }
}

const acceptWarranty = async (req, res) => {
    try {
        const { bookingWarrantyId } = req.params;
        const formData = { status: req.body.status };

        if (!bookingWarrantyId || !formData.status) {
            return res.status(400).json({ error: 'Thiếu bookingWarrantyId hoặc status' });
        }

        const validStatuses = ['PENDING','CONFIRMED'];
        if (!validStatuses.includes(formData.status)) {
            return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
        }

    const {bookingWarranty} = await bookingWarrantyService.updateWarrantyById(bookingWarrantyId, formData);
        
       
        res.status(200).json(bookingWarranty);
    } catch (error) {
        console.error('Lỗi khi cập nhật trạng thái bảo hành:', error);
        res.status(500).json({ error: error.message || 'Đã xảy ra lỗi server' });
    }
};
const denyWarranty = async (req, res) => {
    try {
        const { bookingWarrantyId } = req.params;
        const { status, rejectionReason } = req.body;
        const formData = { status, rejectionReason };

        if (!bookingWarrantyId || !formData.status) {
            return res.status(400).json({ error: 'Thiếu bookingWarrantyId hoặc status' });
        }

        const validStatuses = ['PENDING', 'DENIED'];
        if (!validStatuses.includes(formData.status)) {
            return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
        }

        if (formData.status === 'DENIED' && !formData.rejectionReason) {
            return res.status(400).json({ error: 'Lý do từ chối là bắt buộc khi trạng thái là DENIED' });
        }

        const bookingWarranty = await bookingWarrantyService.updateWarrantyById(bookingWarrantyId, formData);
        if (!bookingWarranty) {
            return res.status(404).json({ error: 'Không tìm thấy đơn bảo hành' });
        }

        res.status(200).json(bookingWarranty);
    } catch (error) {
        console.error('Lỗi khi cập nhật trạng thái bảo hành:', error);
        res.status(500).json({ error: error.message || 'Đã xảy ra lỗi server' });
    }
};

const confirmWarranty = async (req,res) => {
    try {
        const { bookingWarrantyId } = req.params;
        const { status, solutionNote } = req.body;
        const formData = { status, solutionNote };
        if (!bookingWarrantyId || !formData.status) {
            return res.status(400).json({ error: 'Thiếu bookingWarrantyId hoặc status' });
        }
        const validStatuses = ['PENDING', 'CONFIRMED', 'RESOLVED','DONE'];
        if (!validStatuses.includes(formData.status)) {
            return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
        }
        const bookingWarranty = await bookingWarrantyService.updateWarrantyById(bookingWarrantyId, formData);
        if (!bookingWarranty) {
            return res.status(404).json({ error: 'Không tìm thấy đơn bảo hành' });
        }

        res.status(200).json(bookingWarranty);
    } catch (error) {
        console.error('Lỗi khi cập nhật trạng thái bảo hành:', error);
        res.status(500).json({ error: error.message || 'Đã xảy ra lỗi server' });
    }
}

module.exports = {
    requestBookingWarranty,
    getBookingWarrantyById,
    acceptWarranty,
    denyWarranty,
    confirmWarranty
}; 
