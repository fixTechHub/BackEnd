const PayOs = require('@payos/node');
const bookingService = require('./bookingService');
const BookingPrice = require('../models/BookingPrice');
const receiptService = require('./receiptService');
const mongoose = require('mongoose');
const commissionService = require('./commissionService');
const {generateOrderCode } = require('../utils/generateCode')

const payOs = new PayOs(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY
);

const createPayOsPayment = async ( bookingPriceId) => {
    try {
        // PayOS requires a unique integer for orderCode.
        const orderCode = await generateOrderCode();

        const paymentData = {
            orderCode: orderCode,
            // amount: bookingPrice.finalPrice,
            amount: 3000,
            description: `Thanh toan don hang `,
            returnUrl: `${process.env.BACK_END_URL}/payments/success?orderCode=${orderCode}&bookingPriceId=${bookingPriceId}`,
            cancelUrl: `${process.env.BACK_END_URL}/payments/cancel?bookingPriceId=${bookingPriceId}` 
        };

        const paymentLink = await payOs.createPaymentLink(paymentData);
        return paymentLink.checkoutUrl;

    } catch (error) {
        console.error('Error creating PayOS payment link:', error);
        throw new Error('Failed to create payment link');
    }
}

const handleSuccessfulPayment = async (orderCode, bookingPriceId) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        if (!orderCode) {
            throw new Error('Thiếu mã đơnđơn');
        }
        if (!bookingPriceId) {
          throw new Error('thiếu id giá đơnđơn');
      }
        const bookingPrice = await BookingPrice.findById(bookingPriceId).session(session)
        if (!bookingPrice) {
            throw new Error('Không tìm thấy giá đơn');
        }

        const booking = await bookingService.getBookingById(bookingPrice.bookingId)
        if (!booking) {
            throw new Error('Không tìm thấy đơnđơn');
        }

        booking.paymentStatus = 'PAID';
        booking.status = 'DONE';
        await booking.save({ session });

        const receiptData = {
            bookingId: booking._id,
            customerId: booking.customerId,
            technicianId: bookingPrice.technicianId,
            paymentGatewayTransactionId: orderCode,
            totalAmount: bookingPrice.finalPrice + bookingPrice.discountValue,
            serviceAmount: bookingPrice.finalPrice,
            discountAmount: bookingPrice.discountValue,
            paidAmount: bookingPrice.finalPrice,
            paymentMethod: 'BANK',
            paymentStatus: 'PAID',
        };
        await receiptService.createReceipt(receiptData, session);

        // Deduct commission from technician's balance
        await commissionService.deductCommission(
            bookingPrice.technicianId,
            bookingPrice.finalPrice,
            session
        );

        await session.commitTransaction();
        session.endSession();
        
        return { success: true };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

module.exports = {
    createPayOsPayment,
    handleSuccessfulPayment
};