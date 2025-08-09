const bookingWarrantyService = require("../services/bookingWarrantyService");
const bookingService = require('../services/bookingService')

const requestBookingWarranty = async (req, res) => {
    try {
        const formData = req.body
        const images = req.s3FileUrls || [];
        const { bookingId, reportedIssue } = formData
        if (!reportedIssue || reportedIssue.trim() === '') {
            return res.status(400).json({ error: 'Vui lòng nhập lý do bảo hành' });
        }
        // if (!images || images.length === 0) {
        //     return res.status(400).json({ error: 'Vui lòng tải lên hình ảnh' });
        // }
        const booking = await bookingService.getBookingById(bookingId)
        const dateNow = new Date()
        if (!booking) {
            return res.status(404).json({ error: 'Không tìm thấy đặt lịch' });
        }
        if (booking.status !== 'DONE') {
            return res.status(400).json({ error: 'Ban chưa có quyền được phép yêu cầu bảo hành!' });
        }
        if (booking.warrantyExpiresAt && dateNow > new Date(booking.warrantyExpiresAt)) {
            return res.status(400).json({ error: 'Thời hạn bảo hành đã hết. Bạn không thể gửi yêu cầu bảo hành.' });
        }
        const bookingWarranty = await bookingWarrantyService.requestWarranty(bookingId, reportedIssue, images);
    

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
        const { bookingWarrantyId } = req.params

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

        const validStatuses = ['PENDING', 'CONFIRMED'];
        if (!validStatuses.includes(formData.status)) {
            return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
        }

        const { bookingWarranty } = await bookingWarrantyService.updateWarrantyById(bookingWarrantyId, formData);


        res.status(200).json(bookingWarranty);
    } catch (error) {
        console.error('Lỗi khi cập nhật trạng thái bảo hành:', error);
        res.status(500).json({ error: error.message || 'Đã xảy ra lỗi server' });
    }
};
const denyWarranty = async (req, res) => {
    try {
        const { bookingWarrantyId } = req.params;
        const { status, rejectedReason } = req.body;
        const formData = { status, rejectedReason };

        if (!bookingWarrantyId || !formData.status) {
            return res.status(400).json({ error: 'Thiếu bookingWarrantyId hoặc status' });
        }

        const validStatuses = ['PENDING', 'DENIED'];
        if (!validStatuses.includes(formData.status)) {
            return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
        }

        if (formData.status === 'DENIED' && !formData.rejectedReason) {
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

const confirmWarranty = async (req, res) => {
    try {
        const { bookingWarrantyId } = req.params;
        const { status, solutionNote } = req.body;
        const formData = { status, solutionNote };
        if (!bookingWarrantyId || !formData.status) {
            return res.status(400).json({ error: 'Thiếu bookingWarrantyId hoặc status' });
        }
        const validStatuses = ['PENDING', 'CONFIRMED', 'RESOLVED', 'DONE'];
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

const proposeWarrantySchedule = async (req, res) => {
    try {
        const bookingWarrantyId = req.params.bookingWarrantyId;
        const proposedSchedule = req.body.proposedSchedule; // dạng ISO string hoặc timestamp
        if (!proposedSchedule) {
            return res.status(404).json({ error: 'Hãy chọn thời gian phù hợp' });
        }
        const result = await bookingWarrantyService.requestWarrantyDate(bookingWarrantyId, proposedSchedule);
        res.status(200).json({  result });
    } catch (error) {
        console.error('Propose Schedule Error:', error);
        res.status(400).json({  error: error.message });
    }
};

const confirmWarrantySchedule = async (req, res) => {
    try {
        const bookingWarrantyId = req.params.bookingWarrantyId;
        const { startTime, expectedEndTime } = req.body;
        if (!expectedEndTime) {
            return res.status(404).json({ error: 'Hãy chọn thời gian phù hợp' });
        }
        const result = await bookingWarrantyService.confirmWarrantySchedule(bookingWarrantyId,startTime, expectedEndTime);
        res.status(200).json({ result });
    } catch (error) {
        console.error('Confirm Schedule Error:', error);
        res.status(400).json({ error: error.message });
    }
};


module.exports = {
    requestBookingWarranty,
    getBookingWarrantyById,
    acceptWarranty,
    denyWarranty,
    confirmWarranty,
    proposeWarrantySchedule,
    confirmWarrantySchedule
}; 
