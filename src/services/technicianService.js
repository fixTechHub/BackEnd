const Certificate = require('../models/Certificate');
const mongoose = require('mongoose');
const Technician = require('../models/Technician');
const Service = require('../models/Service');
const BookingItem = require('../models/BookingItem');
const BookingPrice = require('../models/BookingPrice');
const CommissionConfig = require('../models/CommissionConfig');
const Booking = require('../models/Booking');
const BookingStatusLog = require('../models/BookingStatusLog');
const User = require('../models/User');
const DepositLog = require('../models/DepositLog');

const createNewTechnician = async (userId, technicianData, session = null) => {
  const technician = new Technician({
    userId,
    identification: technicianData.identification,
    experienceYears: technicianData.experienceYears || 0,
    currentLocation: technicianData.currentLocation || {
      type: 'Point',
      coordinates: [0, 0]
    },
    specialtiesCategories: technicianData.specialtiesCategories || [],
    certificate: technicianData.certificate || [],
    frontIdImage: technicianData.frontIdImage || null,
    backIdImage: technicianData.backIdImage || null,
    certificateVerificationStatus: false,
    jobCompleted: 0,
    availability: 'FREE',
    contractAccepted: false,
    balance: 0,
    isAvailableForAssignment: false,
    bankAccount: technicianData.bankAccount || {
      bankName: '',
      accountNumber: '',
      accountHolder: '',
      branch: ''
    }
  });

  return await technician.save({ session });
};

const findTechnicianByUserId = async (userId) => {
  return await Technician.findOne({ userId })
}

const findNearbyTechnicians = async (searchParams, radiusInKm) => {
  const { latitude, longitude, serviceId, availability, status, minBalance } = searchParams;
  const service = await Service.findById(serviceId).select('categoryId').lean();
  // console.log(service);

  if (!service) {
    console.log(`Không tìm thấy service nào với ID: ${serviceId}`);
    return null;
  }
  const categoryId = service.categoryId;
  // console.log("Tìm thấy categoryId:", categoryId);

  const maxDistanceInMeters = radiusInKm * 1000;

  try {
    // Tạo query object
    let matchQuery = {
      availability: availability,
      status: status,
      balance: { $gte: minBalance },
    };
    if (categoryId) {
      matchQuery.specialtiesCategories = new mongoose.Types.ObjectId(categoryId);
    }

    // Sử dụng currentLocation và chỉ định index cụ thể
    const technicians = await Technician.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [longitude, latitude]
          },
          distanceField: "distance",
          maxDistance: maxDistanceInMeters,
          spherical: true,
          key: "currentLocation",
          query: matchQuery
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'specialtiesCategories',
          foreignField: '_id',
          as: 'category'
        }
      },
      {
        $project: {
          userId: 1,
          currentLocation: 1,
          status: 1,
          ratingAverage: 1,
          jobCompleted: 1,
          experienceYears: 1,
          specialtiesCategories: 1,
          availability: 1,
          balance: 1,
          distance: 1,
          // Chuyển đổi distance từ meters sang km
          distanceInKm: { $round: [{ $divide: ["$distance", 1000] }, 2] },
          // Thêm thông tin user
          userInfo: { $arrayElemAt: ["$userInfo", 0] },
          // category: 1
        }
      },
      {
        $sort: {
          distance: 1
        }
      },
      {
        $limit: 10
      }
    ]);

    return {
      success: true,
      data: technicians,
      total: technicians.length
    };

  } catch (error) {
    console.error('Lỗi khi tìm thợ:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
};

const sendQuotation = async (bookingPriceData) => {
  const { bookingId, userId, laborPrice, warrantiesDuration, items } = bookingPriceData;

  const technician = await Technician.findOne({ userId });
  if (!technician) {
    throw new Error('Không tìm thấy thông tin kỹ thuật viên');
  }

  const technicianId = technician._id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) {
      throw new Error('Không tìm thấy đặt lịch');
    }

    // if (booking.status !== 'PENDING') {
    //     throw new Error('Không thể tạo báo giá cho đặt lịch này');
    // }

    // Set exprire time
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Get current commission applied
    const activeConfig = await CommissionConfig.findOne({ isApplied: true }).session(session);
    if (!activeConfig) {
      throw new Error("Chưa có cấu hình hoa hồng nào được áp dụng!");
    }

    // Calulate the total of items
    const totalItemPrice = (items && Array.isArray(items))
      ? items.reduce((total, item) => total + (item.price * item.quantity), 0)
      : 0;
    const finalPrice = laborPrice + totalItemPrice;

    const newBookingPrice = new BookingPrice({
      bookingId,
      technicianId,
      laborPrice,
      warrantiesDuration,
      finalPrice,
      commissionConfigId: activeConfig._id,
      expiresAt: expiresAt
    });
    const savedBookingPrice = await newBookingPrice.save({ session });
    console.log('--- NEW BOOKING PRICE ---', savedBookingPrice);

    let savedBookingItems = [];
    if (items && Array.isArray(items) && items.length > 0) {
      const bookingItems = items.map(item => ({
        bookingPriceId: savedBookingPrice._id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        note: item.note
      }));
      savedBookingItems = await BookingItem.insertMany(bookingItems, { session });
    }

    await BookingStatusLog.create([{
      bookingId,
      fromStatus: booking.status,
      toStatus: 'QUOTED',
      changedBy: technicianId,
      role: 'TECHNICIAN'
    }], { session });

    booking.status = 'QUOTED';
    await booking.save({ session });

    await session.commitTransaction();

    return {
      message: 'Gửi báo giá thành công',
      bookingPrice: savedBookingPrice,
      bookingItems: savedBookingItems,
      totalItems: totalItemPrice
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Lỗi trong quá trình gửi báo giá:", error);
    throw new Error(`Lỗi gửi báo giá: ${error.message}`);
  }
};

const confirmJobDoneByTechnician = async (bookingId, userId, role) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new Error('Không tìm thấy booking');
    }

    // Kiểm tra quyền
    if (role === 'CUSTOMER' && booking.customerId.toString() !== userId) {
      throw new Error('Bạn không có quyền xác nhận booking này');
    }
    if (role === 'TECHNICIAN' && booking.technicianId?.toString() !== userId.toString()) {
      throw new Error('Bạn không có quyền xác nhận booking này');
    }

    // Kiểm tra trạng thái hiện tại
    if (booking.status === 'CANCELLED') {
      throw new Error('Booking đã bị hủy trước đó');
    }
    if (booking.status === 'PENDING') {
      throw new Error('Không thể hoàn thành booking khi chưa chọn thợ');
    }
    if (booking.status === 'WAITING_CONFIRM') {
      throw new Error('Bạn đã xác nhận hoàn thành rồi!!');
    }

    // Cập nhật trạng thái booking
    await Booking.findByIdAndUpdate(
      bookingId,
      {
        $set: {
          status: 'WAITING_CONFIRM',
          technicianConfirmedDone: true,
          isChatAllowed: false,
          isVideoCallAllowed: false
        }
      },
      { session }
    );

    // Lưu log trạng thái
    await BookingStatusLog.create([{
      bookingId,
      fromStatus: booking.status,
      toStatus: 'WAITING_CONFIRM',
      changedBy: userId,
      role
    }], { session });

    await session.commitTransaction();

    // Lấy lại booking sau khi cập nhật
    const updatedBooking = await Booking.findById(bookingId);
    return updatedBooking;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getTechnicianProfile = async (technicianId) => {
  const technician = await Technician.findById(technicianId)
    .populate('userId')  // Populate để lấy thông tin User
    .populate('specialtiesCategories');  // Nếu muốn lấy luôn categories (nếu có)


  console.log(technician);
  if (!technician) {
    throw new Error('Technician not found');
  }

  return technician
};

const getCertificatesByTechnicianId = async (technicianId) => {
  if (!technicianId || !mongoose.Types.ObjectId.isValid(technicianId)) {
    throw { status: 400, message: 'Invalid technician ID' };
  }

  const certificates = await Certificate.find({ technicianId }).sort({ createdAt: -1 });

  return certificates;
};

const registerAsTechnician = async (data) => {
  const { userId, identification, currentLocation, specialtiesCategories, experienceYears, bankAccount } = data;

  // Kiểm tra user có tồn tại không
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  // Kiểm tra user đã là technician chưa
  const existingTechnician = await Technician.findOne({ userId });
  if (existingTechnician) {
    const error = new Error('User is already registered as a technician');
    error.statusCode = 400;
    throw error;
  }

  // Tạo mới technician với trạng thái chờ xét duyệt
  const newTechnician = await Technician.create({
    userId,
    identification,
    currentLocation,
    specialtiesCategories,
    experienceYears,
    bankAccount
  });

  return newTechnician;
};

const getJobDetails = async (bookingId, technicianId) => {
  const booking = await Booking.findById(bookingId)
    .populate('customerId')
    .populate('serviceId')

  if (!booking) {
    throw { status: 404, message: 'Booking not found' };
  }

  return booking;
};

const getListBookingForTechnician = async (technicianId) => {
  const bookings = await Booking.find({ technicianId })
    .sort({ createdAt: -1 }) // sắp xếp mới nhất trước
    .populate({
      path: 'customerId',
      select: 'fullName' // assuming User model có fullName
    })
    .populate({
      path: 'serviceId',
      select: 'serviceName'
    });

  // format dữ liệu trả về
  return bookings.map(booking => ({
    bookingCode: booking.bookingCode,
    customerName: booking.customerId?.fullName || 'N/A',
    serviceName: booking.serviceId?.serviceName || 'N/A',
    address: booking.location?.address || 'N/A',
    schedule: booking.schedule,
    status: booking.status
  }));
};


const getEarningsAndCommissionList = async (technicianId) => {

  const quotes = await BookingPrice.find(technicianId)
    .sort({ createdAt: -1 })
    .populate('commissionConfigId')
    .populate({
      path: 'bookingId',
      populate: [
        { path: 'customerId', select: 'fullName' },
        { path: 'serviceId', select: 'serviceName' }
      ]
    })

  const earningList = quotes.map(quote => ({
    // bookingId: quote.bookingId._id,
    bookingCode: quote.bookingId?.bookingCode,
    bookingInfo: {
      customerName: quote.bookingId?.customerId,
      service: quote.bookingId?.serviceId,
    },
    finalPrice: quote.finalPrice || 0,
    commissionAmount: quote.commissionAmount || 0,
    holdingAmount: quote.holdingAmount || 0,
    technicianEarning: quote.technicianEarning || 0,

  }));

  return earningList;
};

const getAvailability = async (technicianId) => {
  const technician = await Technician.findById(technicianId).select('availability');

  if (!technician) {
    throw new Error('Technician not found');
  }

  return technician.availability;
};

const updateTechnicianAvailability = async (technicianId) => {

  const onJobStatuses = ['PENDING', 'QUOTED', 'IN_PROGRESS', 'WAITING_CONFIRM'];
  const hasOngoing = await Booking.exists({
    technicianId,
    status: { $in: onJobStatuses }
  });

  if (hasOngoing) {
    return await Technician.findByIdAndUpdate(
      technicianId,
      { availability: 'ONJOB' },
      { new: true }
    );
  }

  const technician = await Technician.findById(technicianId);
  if (!technician) {
    throw new Error('Technician not found');
  }

  const newAvailability = technician.availability === 'FREE' ? 'BUSY' : 'FREE';

  return await Technician.findByIdAndUpdate(
    technicianId,
    { availability: newAvailability },
    { new: true }
  );
};

const depositMoney = async (technicianId, amount, paymentMethod) => {
  if (amount <= 0) {
    throw new Error('Số tiền nạp phải lớn hơn 0');
  }

  const technician = await Technician.findById(technicianId);
  if (!technician) {
    throw new Error('Kỹ thuật viên không tồn tại');
  }

  const balanceBefore = technician.balance;
  technician.balance += amount;

  const log = await DepositLog.create({
    technicianId,
    type: 'DEPOSIT',
    amount,
    status: 'COMPLETED',
    paymentMethod,
    balanceBefore,
    balanceAfter: technician.balance
  });

  await technician.save();

  return {
    balanceBefore,
    balanceAfter: technician.balance,
    log
  };
};

const requestWithdraw = async (technicianId, amount, paymentMethod) => {
  if (amount <= 0) {
    throw new Error('Số tiền rút phải lớn hơn 0');
  }

  const technician = await Technician.findById(technicianId);
  if (!technician) {
    throw new Error('Kỹ thuật viên không tồn tại');
  }

  if (technician.balance < amount) {
    throw new Error('Số dư không đủ');
  }

  const balanceBefore = technician.balance;

  // Chưa trừ tiền, đợi admin duyệt mới trừ
  const log = await DepositLog.create({
    technicianId,
    type: 'WITHDRAW',
    amount,
    status: 'PENDING',
    paymentMethod,
    balanceBefore
  });

  return {
    message: 'Yêu cầu rút tiền đã gửi đến admin',
    log
  };
};



const getTechnicianById = async (technicianId) => {

  try {
    if (!mongoose.Types.ObjectId.isValid(technicianId)) {
      throw new Error('ID Kỹ thuật viên không hợp lệ');
    }
    const technician = await Technician.findById(technicianId)
    if (!technician) {
      throw new Error('Không tìm thấy Kỹ thuật viên');
    }

    return technician;
  } catch (error) {

    throw error;
  }
}
const getTechnicianDepositLogs = async (userId, limit, skip) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('ID Kỹ thuật viên không hợp lệ');
    }
    const technician = await Technician.findOne({ userId }).lean();
    if (!technician) {
      throw new Error('Không tìm thấy Kỹ thuật viên');
    }
    const technicianId = technician._id;
    const depositLogs = await DepositLog.find({ technicianId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    return depositLogs;
  } catch (error) {
    throw new Error(`Failed to fetch deposit logs: ${error.message}`);
  }
};

module.exports = {
  registerAsTechnician,
  getTechnicianProfile,
  getCertificatesByTechnicianId,
  getJobDetails,
  getEarningsAndCommissionList,
  getAvailability,
  updateTechnicianAvailability,
  findNearbyTechnicians,
  sendQuotation,
  confirmJobDoneByTechnician,
  getTechnicianById,
  findTechnicianByUserId,
  getListBookingForTechnician,
  depositMoney,
  requestWithdraw,
  createNewTechnician,
  findTechnicianByUserId,
  getTechnicianDepositLogs
};

