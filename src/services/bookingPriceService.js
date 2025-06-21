const mongoose = require('mongoose');
const BookingPrice = require('../models/BookingPrice');
const BookingItem = require('../models/BookingItem');
const Booking = require('../models/Booking');

const getAllQuotations = async (bookingId) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            throw new Error('ID đặt lịch không hợp lệ');
        }

        const quotations = await BookingPrice.find({ bookingId })
            .populate({
                path: 'technicianId',
                populate: [
                    { path: 'userId' },
                    { path: 'specialtiesCategories' }
                ]
            })
            .populate('commissionConfigId')
            .sort({ quotedAt: -1 });

        return quotations;
    } catch (error) {
        throw error;
    }
};

const getQuotationDetail = async (quotationId) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(quotationId)) {
            throw new Error('ID báo giá không hợp lệ');
        }

        const quotation = await BookingPrice.findById(quotationId)
            .populate('technicianId')
            .populate('commissionConfigId')
            .populate('bookingId');

        if (!quotation) {
            throw new Error('Không tìm thấy báo giá');
        }

        // Lấy danh sách các items trong báo giá
        const items = await BookingItem.find({ bookingPriceId: quotationId });

        return {
            quotation,
            items
        };
    } catch (error) {
        throw error;
    }
};

const acceptQuotation = async (quotationId, customerId) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        if (!mongoose.Types.ObjectId.isValid(quotationId)) {
            throw new Error('ID báo giá không hợp lệ');
        }

        const quotation = await BookingPrice.findById(quotationId)
            .populate('bookingId');
        console.log('--- ACCEPT QUOTATION LOG', quotation);

        if (!quotation) {
            throw new Error('Không tìm thấy báo giá');
        }

        if (quotation.bookingId.customerId.toString() !== customerId.toString()) {
            throw new Error('Bạn không có quyền chấp nhận báo giá này');
        }

        if (quotation.bookingId.status !== 'QUOTED') {
            throw new Error('Không thể chấp nhận báo giá cho booking này');
        }

        quotation.status = 'ACCEPTED';
        await quotation.save({ session });

        quotation.bookingId.status = 'IN_PROGRESS';
        quotation.bookingId.technicianId = quotation.technicianId;
        quotation.bookingId.isChatAllowed = true;
        quotation.bookingId.isVideoCallAllowed = true;
        await quotation.bookingId.save({ session });

        await BookingPrice.updateMany(
            {
                bookingId: quotation.bookingId._id,
                _id: { $ne: quotationId }
            },
            {
                $set: { status: 'REJECTED' }
            },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return quotation;
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

module.exports = {
    getAllQuotations,
    getQuotationDetail,
    acceptQuotation
}; 