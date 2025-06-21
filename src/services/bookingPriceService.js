const mongoose = require('mongoose');
const BookingPrice = require('../models/BookingPrice');
const BookingItem = require('../models/BookingItem');
const bookingService = require('./bookingService');
const couponService = require('./couponService');
const CouponUsage = require('../models/CouponUsage');
const paymentService = require('./paymentService');
const receiptService = require('./receiptService');
const technicianService = require('./technicianService');
const commissionService = require('./commissionService');

const getAllQuotations = async (bookingId) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            throw new Error('ID đặt lịch không hợp lệ');
        }

        const quotations = await BookingPrice.find({ bookingId })
            .populate('technicianId')
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

const getAcceptedQuotation = async (bookingId, technicianId) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            throw new Error('ID đặt lịch không hợp lệ');
        }
        if (!mongoose.Types.ObjectId.isValid(technicianId)) {
            throw new Error('ID thợ không hợp lệ');
        }
        const bookingPrice = await BookingPrice.findOne({
            bookingId: bookingId,
            technicianId: technicianId,
            status: 'ACCEPTED'
        })
            .populate({
                path: 'technicianId',
                populate: {
                    path: 'userId',
                    select: 'fullName avatar'
                }
            })
            .populate('bookingId');
        if (!bookingPrice) {
            throw new Error('Không tìm thấy báo giá');
        }
        await session.commitTransaction();
        session.endSession();
        
        return bookingPrice
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }

}

const getBookingItemsByBookingPriceId = async (bookingPriceId) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        if (!mongoose.Types.ObjectId.isValid(bookingPriceId)) {
            throw new Error('ID báo giá không hợp lệ');
        }
        const bookingItems = await BookingItem.find({
            bookingPriceId: bookingPriceId
        })
        if (!bookingItems) {
            throw new Error('Không tìm thấy vật liệu');
        }
        await session.commitTransaction();
        session.endSession();
        return bookingItems
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
}

const updateBookingPriceAddCoupon = async (bookingPriceId, couponCode, discountValue, finalPrice, paymentMethod) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        if (!mongoose.Types.ObjectId.isValid(bookingPriceId)) {
            throw new Error('ID báo giá không hợp lệ');
        }
        const update = {};
        let bookingPriceDoc = await getBookingPriceById(bookingPriceId)
        
        if (!bookingPriceDoc) {
            throw new Error('Không tìm thấy báo giá để cập nhật');
        }
        if (couponCode) {
            update.discountCode = couponCode;
            update.discountValue = discountValue;
            update.finalPrice = finalPrice;
            // Find coupon document
            const couponDoc = await couponService.getCouponByCouponCode(couponCode)
            if (!couponDoc) {
                throw new Error('Không tìm thấy mã giảm giá');
            }
            // Find userId from booking
            let userId = null;
            if (bookingPriceDoc.bookingId) {
                const bookingDoc = await bookingService.getBookingById(bookingPriceDoc.bookingId)
                console.log(bookingDoc);
                
                if (bookingDoc && bookingDoc.customerId) {
                    userId = bookingDoc.customerId;
                }
            }
            if (!userId) {
                throw new Error('Không tìm thấy userId để lưu CouponUsage');
            }
            // Create CouponUsage if not already used
            const existingUsage = await CouponUsage.findOne({ couponId: couponDoc._id, userId: userId }).session(session);
            if (!existingUsage) {
                await CouponUsage.create([{ couponId: couponDoc._id, userId: userId, bookingId: bookingPriceDoc.bookingId }], { session });
            }
        } else {
            update.discountCode = null;
            update.discountValue = 0;
            update.finalPrice = finalPrice;
        }
        const updatedBookingPrice = await BookingPrice.findByIdAndUpdate(
            bookingPriceId,
            { $set: update },
            { new: true, session }
        );
        if (!updatedBookingPrice) {
            throw new Error('Không tìm thấy báo giá để cập nhật');
        }

        let paymentUrl = null;
        if (paymentMethod === 'PAYOS') {
            paymentUrl = await paymentService.createPayOsPayment( bookingPriceId);
        } else if (paymentMethod === 'CASH') {
            // Handle cash payment:
            // 1. Update booking status and create receipt
            const booking = await bookingService.getBookingById(updatedBookingPrice.bookingId)
            if (booking) {
                booking.paymentStatus = 'PAID';
                booking.status = 'DONE';
                await booking.save({ session });

                const receiptData = {
                    bookingId: booking._id,
                    customerId: booking.customerId,
                    technicianId: updatedBookingPrice.technicianId,
                    totalAmount: updatedBookingPrice.finalPrice + updatedBookingPrice.discountValue,
                    serviceAmount: updatedBookingPrice.finalPrice,
                    discountAmount: updatedBookingPrice.discountValue,
                    paidAmount: updatedBookingPrice.finalPrice,
                    paymentMethod: 'CASH',
                    paymentStatus: 'PAID',
                };
                await receiptService.createReceipt(receiptData, session);

                // 2. Deduct commission from technician's balance
                await commissionService.deductCommission(
                    updatedBookingPrice.technicianId,
                    updatedBookingPrice.finalPrice,
                    session
                );
            }
        }

        await session.commitTransaction();
        session.endSession();

        return { bookingPrice: updatedBookingPrice, paymentUrl: paymentUrl };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

const getBookingPriceById = async (bookingPriceId) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(bookingPriceId)) {
            throw new Error('ID giá cả đơn hàng không hợp lệ');
        }

        const bookingPrice = await BookingPrice.findById(bookingPriceId);

        if (!bookingPrice) {
            throw new Error('Không tìm thấy giá đơn hàng');
        }

        return bookingPrice;
    } catch (error) {
        throw error;
    }
}

const getBookingPriceIdForUser = async (bookingPriceId) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(bookingPriceId)) {
            throw new Error('ID báo giá không hợp lệ');
        }
        const bookingPrice = await BookingPrice.findById(bookingPriceId).populate({
            path: 'bookingId',
            populate: {
                path: 'customerId',
                model: 'User'
            }
        });
        if (!bookingPrice) {
            throw new Error('Không tìm thấy báo giá');
        }
        return bookingPrice;
    } catch (error) {
        throw error;
    }
};

module.exports = {
    getAllQuotations,
    getQuotationDetail,
    acceptQuotation,
    getAcceptedQuotation,
    getBookingItemsByBookingPriceId,
    updateBookingPriceAddCoupon,
    getBookingPriceById,
    getBookingPriceIdForUser
}; 