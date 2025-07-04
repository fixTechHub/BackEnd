const PayOs = require('@payos/node');
const bookingService = require('./bookingService');
const BookingPrice = require('../models/BookingPrice');
const receiptService = require('./receiptService');
const mongoose = require('mongoose');
const commissionService = require('./commissionService');
const {generateOrderCode } = require('../utils/generateCode')
const Technician = require('../models/Technician');
const DepositLog = require('../models/DepositLog');
const payOs = new PayOs(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY
);

const createPayOsPayment = async ( bookingPriceId) => {
    try {
        // PayOS requires a unique integer for orderCode.
        const orderCode = await generateOrderCode();
        const bookingPrice = await BookingPrice.findById(bookingPriceId)
        const paymentData = {
            orderCode: orderCode,
            amount: bookingPrice.finalPrice,
            // amount: 3000,
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
            throw new Error('Thiếu mã đơn');
        }
        if (!bookingPriceId) {
          throw new Error('thiếu id giá đơn');
      }
        const bookingPrice = await BookingPrice.findById(bookingPriceId).session(session)
        if (!bookingPrice) {
            throw new Error('Không tìm thấy giá đơn');
        }

        const booking = await bookingService.getBookingById(bookingPrice.bookingId)
        if (!booking) {
            throw new Error('Không tìm thấy đơn');
        }

        booking.paymentStatus = 'PAID';
        booking.status = 'DONE';
        booking.isChatAllowed = false
        booking.isVideoCallAllowed = false
        booking.warrantyExpiresAt = new Date();
        booking.warrantyExpiresAt.setDate(
            booking.warrantyExpiresAt.getDate() + bookingPrice.warrantiesDuration
        );
        await booking.save({ session });

        const receiptTotalAmount = bookingPrice.finalPrice + bookingPrice.discountValue;
        bookingPrice.holdingAmount = receiptTotalAmount * 0.2;
        bookingPrice.commissionAmount = receiptTotalAmount * 0.1;
        await bookingPrice.save({ session });
        const technician = await Technician.findById(bookingPrice.technicianId)
        technician.availability = 'FREE'
        await technician.save({session})
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

        // Credit commission from technician's balance
        await commissionService.creditCommission(
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

const createPayOsDeposit = async (userId, amount) => {
    try {
        // PayOS requires a unique integer for orderCode.
        const orderCode = await generateOrderCode();
        const paymentData = {
            orderCode: orderCode,
            amount: amount,
            description: `Nap tien vao tai khoan`,
            returnUrl: `${process.env.BACK_END_URL}/payments/deposit/success?userId=${userId}&amount=${amount}`,
            cancelUrl: `${process.env.BACK_END_URL}/payments/deposit/cancel?userId=${userId}&amount=${amount}` 
        };

        const paymentLink = await payOs.createPaymentLink(paymentData);
        return paymentLink.checkoutUrl;

    } catch (error) {
        console.error('Error creating PayOS payment link:', error);
        throw new Error('Failed to create payment link');
    }
}




const handleSuccessfulDeposit = async (amount, userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  const amountNumber = Number(amount);
  try {
    if (!amount) {
      throw new Error('Không có tiền để nạp');
    }

    if (!userId) {
      throw new Error('Thiếu ID người dùng');
    }

    const technician = await Technician.findOne({ userId }).session(session);
    if (!technician) {
      throw new Error('Không tìm thấy kỹ thuật viên');
    }

    const balanceBefore = technician.balance;
    const balanceAfter = balanceBefore + amountNumber;

    // Update balance
    technician.balance = balanceAfter;
    await technician.save({ session });

    // Create deposit log
    const depositLog = new DepositLog({
      technicianId: technician._id,
      type: 'DEPOSIT',
      amount: amount,
      status: 'COMPLETED',
      paymentMethod: 'BANK', // Or dynamically set if you have it
      balanceBefore: balanceBefore,
      balanceAfter: balanceAfter,
      note: `Nạp ${amount}đ thành công`,
    });

    await depositLog.save({ session });

    // Commit transaction
    await session.commitTransaction();
    session.endSession();
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const handleCancelDeposit = async (amount,userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!userId) {
      throw new Error('Thiếu ID người dùng');
    }

    const technician = await Technician.findOne({ userId }).session(session);
    if (!technician) {
      throw new Error('Không tìm thấy kỹ thuật viên');
    }
    const balanceBefore = technician.balance;
    const balanceAfter = balanceBefore;
    // Create deposit log
    const depositLog = new DepositLog({
      technicianId: technician._id,
      type: 'DEPOSIT',
      amount: amount,
      status: 'CANCELLED',
      paymentMethod: 'BANK', // Or dynamically set if you have it
      balanceBefore: balanceBefore,
      balanceAfter: balanceAfter,
      note: `Hủy nạp ${amount}đ thành công`,
    });

    await depositLog.save({ session });

    // Commit transaction
    await session.commitTransaction();
    session.endSession();
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

module.exports = {
    createPayOsPayment,
    handleSuccessfulPayment,
    createPayOsDeposit,
    handleSuccessfulDeposit,
    handleCancelDeposit
};