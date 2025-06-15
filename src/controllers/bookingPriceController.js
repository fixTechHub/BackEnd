const bookingPriceService = require("../services/bookingPriceService");

const getAllQuotations = async (req, res) => {
    try {
        const bookingId = req.params.bookingId;
        // console.log(bookingId);

        const quotations = await bookingPriceService.getAllQuotations(bookingId);
        console.log('--- ALL QUOTATION ---', quotations);

        res.status(200).json({
            success: true,
            message: 'Lấy tất cả báo giá thành công',
            data: quotations
        })
    } catch (error) {
        console.error('Lỗi khi lấy danh sách báo giá:', error);

        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi lấy danh sách báo giá',
            error: error.message
        });
    }
};

const getQuotationDetail = async (req, res) => {
    try {
        const quotationId = req.params.quotationId;

        const quotation = await bookingPriceService.getQuotationDetail(quotationId);
        console.log('--- QUOTATION DETAIL ---', quotation);

        res.status(200).json({
            success: true,
            message: 'Lấy chi tiết báo giá thành công',
            data: quotation
        })
    } catch (error) {
        console.error('Lỗi khi lấy báo giá:', error);

        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi lấy báo giá',
            error: error.message
        });
    }
};

const acceptQuotation = async (req, res) => {
    try {
        const quotationId = req.params.quotationId;
        // const customerId = req.user._id;
        const customerId = '68477c06b6efa9a3615217dd' 

        const acceptedQuotation = await bookingPriceService.acceptQuotation(quotationId, customerId);
        // console.log('--- ACCEPTED QUOTATION ---');

        res.status(200).json({
            success: true,
            message: 'Báo giá của bạn đã được chấp nhận',
            data: acceptedQuotation
        })
    } catch (error) {
        console.error('Lỗi khi chấp nhận báo giá:', error);

        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi chấp nhận báo giá',
            error: error.message
        });
    }
};

module.exports = {
    getAllQuotations,
    getQuotationDetail,
    acceptQuotation
}; 
