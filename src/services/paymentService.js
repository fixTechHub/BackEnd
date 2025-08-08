const PayOs = require('@payos/node');
const bookingService = require('./bookingService');
// const BookingPrice = require('../models/BookingPrice');
const Booking = require('../models/Booking');
const receiptService = require('./receiptService');
const mongoose = require('mongoose');
const commissionService = require('./commissionService');
const { generateOrderCode } = require('../utils/generateCode')
const Technician = require('../models/Technician');
const DepositLog = require('../models/DepositLog');
const TechnicianServiceModel = require('../models/TechnicianService');
const TechnicianSubscription = require('../models/TechnicianSubscription');
const SubscriptionPackage = require('../models/CommissionPackage');
const CouponUsage = require('../models/CouponUsage');
const couponService = require('./couponService')
const payOs = new PayOs(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY
);

const createPayOsPayment = async (bookingId) => {
  try {
    // PayOS requires a unique integer for orderCode.
    const orderCode = await generateOrderCode();
    const booking = await Booking.findById(bookingId)
    // console.log(booking.finalPrice);
    
    const paymentData = {
      orderCode: orderCode,
      // amount: booking.finalPrice,
      amount: 3000,
      description: `Thanh toan don hang `,
      returnUrl: `${process.env.BACK_END_URL}/payments/success?orderCode=${orderCode}&bookingId=${bookingId}`,
      cancelUrl: `${process.env.BACK_END_URL}/payments/cancel?bookingId=${bookingId}`
    };

    const paymentLink = await payOs.createPaymentLink(paymentData);
    return paymentLink.checkoutUrl;

  } catch (error) {
    console.error('Error creating PayOS payment link:', error);
    throw new Error('Failed to create payment link');
  }
}

const handleSuccessfulPayment = async (orderCode, bookingId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (!orderCode) {
      throw new Error('Thiếu mã đơn');
    }
    if (!bookingId) {
      throw new Error('thiếu id giá đơn');
    }
    const booking = await Booking.findById(bookingId).session(session)
    if (!booking) {
      throw new Error('Không tìm thấy đơn');
    }
  
    booking.paymentStatus = 'PAID';
    booking.status = 'DONE';
    booking.isChatAllowed = false
    booking.isVideoCallAllowed = false
    booking.customerConfirmedDone = true
    booking.warrantyExpiresAt = new Date();
    booking.warrantyExpiresAt.setDate(
      booking.warrantyExpiresAt.getDate() + booking.quote.warrantiesDuration
    );
 
    // Find coupon document
    const couponDoc = await couponService.getCouponByCouponCode(booking.discountCode)
    if (!couponDoc) {
      throw new Error('Không tìm thấy mã giảm giá');
    }
    couponDoc.usedCount += 1;
    await couponDoc.save({ session });
    // Find userId from booking
    const customerId = booking.customerId

    if (!customerId) {
      throw new Error('Không tìm thấy userId để lưu CouponUsage');
    }
    // Create CouponUsage if not already used
    const existingUsage = await CouponUsage.findOne({ couponId: couponDoc._id, userId: booking.customerId }).session(session);
    if (!existingUsage) {
      await CouponUsage.create([{ couponId: couponDoc._id, userId: booking.customerId, bookingId: booking._id }], { session });
    }
    const receiptTotalAmount = booking.finalPrice + booking.discountValue;
    console.log(booking.finalPrice);
    
    booking.holdingAmount = receiptTotalAmount * 0.2;
    await booking.save({ session });
    const TechnicianService = require('../models/TechnicianService');
    const technicianServiceModel = await TechnicianService.findOne({
      serviceId: booking.serviceId,
      technicianId: booking.technicianId
    });
    const technician = await Technician.findById(booking.technicianId)
    technician.availability = 'FREE'
    await technician.save({ session })
    const receiptData = {
      bookingId: booking._id,
      customerId: booking.customerId,
      technicianId: booking.technicianId,
      paymentGatewayTransactionId: orderCode,
      totalAmount: booking.finalPrice + booking.discountValue,
      serviceAmount: technicianServiceModel.price,
      discountAmount: booking.discountValue,
      paidAmount: booking.finalPrice,
      paymentMethod: 'BANK',
      paymentStatus: 'PAID',
      holdingAmount: receiptTotalAmount * 0.2,
    };
    await receiptService.createReceipt(receiptData, session);

    // Credit commission from technician's balance
    await commissionService.creditCommission(
      booking.technicianId,
      booking.finalPrice + booking.discountValue,
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

// const createPayOsSubscription = async (userId, amount) => {
//   try {
//     // PayOS requires a unique integer for orderCode.
//     const orderCode = await generateOrderCode();
//     const paymentData = {
//       orderCode: orderCode,
//       amount: amount,
//       description: `Nap tien vao tai khoan`,
//       returnUrl: `${process.env.BACK_END_URL}/payments/subscription/success?userId=${userId}&amount=${amount}`,
//       cancelUrl: `${process.env.BACK_END_URL}/payments/subscription/cancel?userId=${userId}&amount=${amount}`
//     };

//     const paymentLink = await payOs.createPaymentLink(paymentData);
//     return paymentLink.checkoutUrl;

//   } catch (error) {
//     console.error('Error creating PayOS payment link:', error);
//     throw new Error('Failed to create payment link');
//   }
// };

const createPayOsSubscription = async (userId, { amount, packageId }) => {
  try {
    const amountNumber = Number(amount);
    console.log('🔍 Amount received:', amount, '=> Parsed:', amountNumber, 'Type:', typeof amount);
    // ✅ Kiểm tra số tiền hợp lệ
    if (isNaN(amountNumber) || amountNumber < 1 || amountNumber > 10000000000) {
      throw new Error('Số tiền không hợp lệ. Yêu cầu từ 1đ đến 10 tỷ');
    }

    const orderCode = await generateOrderCode();

    const paymentData = {
      orderCode: orderCode,
      amount: amountNumber,
      description: `Đăng kí gói thành viên`,
      returnUrl: `${process.env.BACK_END_URL}/payments/subscription/success?userId=${userId}&amount=${amountNumber}&packageId=${packageId}`,
      cancelUrl: `${process.env.BACK_END_URL}/payments/subscription/cancel?userId=${userId}&amount=${amountNumber}&packageId=${packageId}`
    };

    const paymentLink = await payOs.createPaymentLink(paymentData);
    return paymentLink.checkoutUrl;

  } catch (error) {
    console.error('Error creating PayOS payment link:', error);
    throw new Error('Failed to create payment link');
  }
};


// const handleSuccessfulSubscription = async (amount, userId) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   const amountNumber = Number(amount);
//   try {
//     if (!amount) {
//       throw new Error('Không có tiền để nạp');
//     }

//     if (!userId) {
//       throw new Error('Thiếu ID người dùng');
//     }

//     const technician = await Technician.findOne({ userId }).session(session);
//     if (!technician) {
//       throw new Error('Không tìm thấy kỹ thuật viên');
//     }

//     const balanceBefore = technician.balance;
//     const balanceAfter = balanceBefore + amountNumber;

//     // Update balance
//     technician.balance = balanceAfter;
//     await technician.save({ session });

//     // Create deposit log
//     const depositLog = new DepositLog({
//       technicianId: technician._id,
//       type: 'DEPOSIT',
//       amount: amount,
//       status: 'COMPLETED',
//       paymentMethod: 'BANK', // Or dynamically set if you have it
//       balanceBefore: balanceBefore,
//       balanceAfter: balanceAfter,
//       note: `Nạp ${amount}đ thành công`,
//     });

//     await depositLog.save({ session });

//     // Commit transaction
//     await session.commitTransaction();
//     session.endSession();
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     throw error;
//   }
// };

const handleSuccessfulSubscription = async (amount, userId, packageId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!amount) throw new Error('Không có tiền để nạp');
    if (!userId) throw new Error('Thiếu ID người dùng');
    if (!packageId) throw new Error('Thiếu ID gói nâng cấp');

    const technician = await Technician.findOne({ userId }).session(session);
    if (!technician) throw new Error('Không tìm thấy kỹ thuật viên');

    const balanceBefore = technician.balance;
    const balanceAfter = balanceBefore;

    // ✅ 1. Update balance
    // technician.balance = balanceAfter;

    // ✅ 2. Update subscriptionPackage
    // technician.subscriptionPackage = packageId;
    // technician.subscriptionStartDate = new Date(); // nếu bạn dùng
    // // Optional: nếu gói có thời hạn, bạn có thể cộng thêm 30 ngày chẳng hạn
    // technician.subscriptionExpireDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); 

    // await technician.save({ session });

    const startDate = new Date();
    const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 ngày

    await TechnicianSubscription.findOneAndUpdate(
      { technician: technician._id, status: 'ACTIVE' },
      {
        package: packageId,
        startDate: startDate,
        endDate: endDate,
      },
      { session, new: true }
    );

    // ✅ 3. Create deposit log
    const depositLog = new DepositLog({
      technicianId: technician._id,
      type: 'SUBSCRIPTION',
      amount: amount,
      status: 'COMPLETED',
      paymentMethod: 'BANK',
      balanceBefore: balanceBefore,
      balanceAfter: balanceAfter,
      note: `Nạp ${amount}đ thành công`,
    });

    await depositLog.save({ session });

    // ✅ 4. Commit
    await session.commitTransaction();
    session.endSession();
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// const extendSubscription = async (req, res) => {
//   try {
//     const { days, technicianId, packageId } = req.body;

//     if (!days || !technicianId || !packageId) {
//       return res.status(400).json({ message: 'Thiếu thông tin!' });
//     }

//     const subscriptionPackage = await SubscriptionPackage.findById(packageId);
//     if (!subscriptionPackage) {
//       return res.status(404).json({ message: 'Không tìm thấy gói!' });
//     }

//     const pricePer30Days = subscriptionPackage.price; // giả sử giá trong DB là theo 30 ngày
//     const amount = Math.ceil((days / 30) * pricePer30Days);

//     const paymentPayload = {
//       amount,
//       description: `Gia hạn gói ${packageId} thêm ${days} ngày`,
//       technicianId,
//       packageId,
//       days,
//     };

//     const checkoutUrl = await createPayOsPayment(paymentPayload);

//     res.json({ checkoutUrl });
//   } catch (err) {
//     console.error('Extend subscription error:', err);
//     res.status(500).json({ message: 'Lỗi tạo thanh toán' });
//   }
// };


const handleCancelSubscription = async (amount, userId) => {
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
};

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

const handleCancelDeposit = async (amount, userId) => {
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

const handleExtendSubscription = async (amount, userId, packageId, days) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!amount || !userId || !packageId || !days) throw new Error('Thiếu thông tin cần thiết');

    const technician = await Technician.findOne({ userId }).session(session);
    if (!technician) throw new Error('Không tìm thấy kỹ thuật viên');

    const balanceBefore = technician.balance;

    // ✅ Tìm subscription hiện tại
    const activeSub = await TechnicianSubscription.findOne({
      technician: technician._id,
      status: 'ACTIVE',
    }).session(session);

    if (!activeSub) throw new Error('Không tìm thấy gói đang sử dụng');

    // ✅ Gia hạn thời gian subscription
    const now = new Date();
    const currentEndDate = new Date(activeSub.endDate);
    const baseDate = currentEndDate > now ? currentEndDate : now;
    const newEndDate = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

    activeSub.endDate = newEndDate;
    await activeSub.save({ session });

    // ✅ Ghi log nạp tiền
    const depositLog = new DepositLog({
      technicianId: technician._id,
      type: 'SUBSCRIPTION_EXTEND',
      amount,
      status: 'COMPLETED',
      paymentMethod: 'BANK',
      balanceBefore,
      balanceAfter: balanceBefore,
      note: `Gia hạn gói ${packageId} thêm ${days} ngày`,
    });

    await depositLog.save({ session });

    await session.commitTransaction();
    session.endSession();
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const getPackageById = async (packageId) => {
  // Ví dụ truy vấn DB
  return await SubscriptionPackage.findById(packageId);
};

const createExtendPayOsPayment = async (technicianId, { amount, packageId, days }) => {
  try {
    const amountNumber = Number(amount);
    console.log('🔁 Gia hạn - Amount received:', amount, '=> Parsed:', amountNumber);
    const technician = await Technician.findById(technicianId);
    if (!technician) throw new Error('Không tìm thấy kỹ thuật viên');

    const userId = technician.userId; // dùng để tạo URL

    // Kiểm tra số tiền hợp lệ
    if (isNaN(amountNumber) || amountNumber < 1 || amountNumber > 10000000000) {
      throw new Error('Số tiền không hợp lệ. Yêu cầu từ 1đ đến 10 tỷ');
    }

    const orderCode = await generateOrderCode();

    const paymentData = {
      orderCode: orderCode,
      amount: amountNumber,
      description: `Gia hạn gói thành viên`,
      returnUrl: `${process.env.BACK_END_URL}/payments/subscription/extend/success?userId=${userId}&amount=${amountNumber}&packageId=${packageId}&days=${days}`,
      cancelUrl: `${process.env.BACK_END_URL}/payments/subscription/extend/cancel?userId=${userId}&amount=${amountNumber}&packageId=${packageId}&days=${days}`,
    };
    console.log('📤 Dữ liệu gửi tới PayOS:', paymentData);
    console.log('🌍 BACK_END_URL:', process.env.BACK_END_URL);

    const paymentLink = await payOs.createPaymentLink(paymentData);
    return paymentLink.checkoutUrl;

  } catch (error) {
    console.error('❌ Lỗi tạo link thanh toán gia hạn:', {
      message: error.message,
      stack: error.stack,
      response: error?.response?.data,
    });
    throw new Error('Không thể tạo link thanh toán gia hạn');
  }
};


module.exports = {
  createPayOsPayment,
  handleSuccessfulPayment,
  createPayOsDeposit,
  handleSuccessfulDeposit,
  handleCancelDeposit,
  createPayOsSubscription,
  handleSuccessfulSubscription,
  handleCancelSubscription,
  handleExtendSubscription,
  getPackageById,
  createExtendPayOsPayment
};