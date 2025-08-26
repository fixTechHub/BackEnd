const Certificate = require('../models/Certificate');
const mongoose = require('mongoose');
const Technician = require('../models/Technician');
const Service = require('../models/Service');
const Booking = require('../models/Booking');
const BookingStatusLog = require('../models/BookingStatusLog');
const User = require('../models/User');
const DepositLog = require('../models/DepositLog');
const notificationService = require('../services/notificationService');
const TechnicianService = require('../models/TechnicianService');
const TechnicianSchedule = require('../models/TechnicianSchedule');

// Hàm tính thời gian di chuyển dự tính (tính bằng phút)
const calculateEstimatedArrivalTime = (distanceInKm, isUrgent = false) => {
  // Tốc độ di chuyển trung bình (km/h)
  // - Trong thành phố: 20-30 km/h (giao thông đông đúc)
  // - Đường ngoại ô: 40-50 km/h
  // - Đường cao tốc: 60-80 km/h
  
  let averageSpeed = 25; // km/h mặc định (trong thành phố)
  
  // Nếu là đặt ngay (urgent), thợ sẽ di chuyển nhanh hơn
  if (isUrgent) {
    averageSpeed = 35; // km/h cho đặt ngay
  }
  
  // Tính thời gian di chuyển (giờ)
  const travelTimeInHours = distanceInKm / averageSpeed;
  
  // Chuyển đổi sang phút
  const travelTimeInMinutes = Math.round(travelTimeInHours * 60);
  
  // Thêm thời gian chuẩn bị (5-15 phút)
  const preparationTime = isUrgent ? 5 : 10;
  
  return {
    travelTimeInMinutes: travelTimeInMinutes + preparationTime,
    travelTimeInHours: travelTimeInHours + (preparationTime / 60),
    averageSpeed: averageSpeed,
    preparationTime: preparationTime
  };
};

// Hàm format thời gian di chuyển thành chuỗi dễ đọc
const formatEstimatedTime = (travelTimeInMinutes) => {
  if (travelTimeInMinutes < 60) {
    return `${travelTimeInMinutes} phút`;
  } else {
    const hours = Math.floor(travelTimeInMinutes / 60);
    const minutes = travelTimeInMinutes % 60;
    if (minutes === 0) {
      return `${hours} giờ`;
    } else {
      return `${hours} giờ ${minutes} phút`;
    }
  }
};

const createNewTechnician = async (userId, technicianData, session = null) => {
  const technician = new Technician({
    userId,
    // Individual account fields
    identification: technicianData.identification,
    frontIdImage: technicianData.frontIdImage || null,
    backIdImage: technicianData.backIdImage || null,
    // Business account fields
    taxCode: technicianData.taxCode || null,
    businessLicenseImage: technicianData.businessLicenseImage || null,
    // Common fields
    experienceYears: technicianData.experienceYears || 0,
    currentLocation: technicianData.currentLocation || {
      type: 'Point',
      coordinates: [0, 0]
    },
    specialtiesCategories: technicianData.specialtiesCategories || [],
    certificate: technicianData.certificate || [],
    inspectionFee: technicianData.inspectionFee || 0,  // phí kiểm tra (default 0)
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
};

// Tách logic tạo match query
const buildMatchQuery = (searchParams, categoryId) => {
  const { status, minBalance, isSubscribe, subscriptionStatus, availability } = searchParams;
  
  let matchQuery = {};
  
  // Chỉ thêm filter status nếu được cung cấp
  if (status) {
    matchQuery.status = status;
  }
  
  // Chỉ thêm filter balance nếu minBalance được cung cấp và hợp lệ
  if (minBalance !== undefined && minBalance !== null && !isNaN(minBalance)) {
    matchQuery.balance = { $gte: minBalance };
  }
  
  if (isSubscribe !== undefined) {
    matchQuery.isSubscribe = isSubscribe;
  }
  
  if (subscriptionStatus && Array.isArray(subscriptionStatus) && subscriptionStatus.length > 0) {
    matchQuery.subscriptionStatus = { $in: subscriptionStatus };
  }
  
  if (availability) {
    if (Array.isArray(availability) && availability.length > 0) {
      matchQuery.availability = { $in: availability };
    } else if (typeof availability === 'string') {
      matchQuery.availability = availability;
    }
  }
  
  if (categoryId) {
    matchQuery.specialtiesCategories = new mongoose.Types.ObjectId(categoryId);
  }
  
  return matchQuery;
};

// Tách logic tạo aggregation pipeline
const buildAggregationPipeline = (searchParams, matchQuery, customerId) => {
  const { latitude, longitude, serviceId, scheduleDate, radiusInKm } = searchParams;
  
  // Kiểm tra và đảm bảo radiusInKm là số dương
  const validRadius = Math.max(0.1, radiusInKm || 10); // Mặc định 10km nếu không có
  const maxDistanceInMeters = validRadius * 1000;
  
  const pipeline = [
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
      $lookup: {
        from: 'technicianservices',
        let: { technicianId: '$_id', serviceId: new mongoose.Types.ObjectId(serviceId) },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$technicianId', '$$technicianId'] },
                  { $eq: ['$serviceId', '$$serviceId'] },
                  { $eq: ['$isActive', true] }
                ]
              }
            }
          }
        ],
        as: 'technicianService'
      }
    },
    {
      $lookup: {
        from: 'technicianschedules',
        let: { technicianId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$technicianId', '$$technicianId'] },
                  { $eq: ['$scheduleType', 'AVAILABLE'] },
                  scheduleDate ? {
                    $and: [
                      { $lte: ['$startTime', new Date(scheduleDate)] },
                      { $gte: ['$endTime', new Date(scheduleDate)] }
                    ]
                  } : {}
                ]
              }
            }
          }
        ],
        as: 'availableSchedules'
      }
    },
    {
      $lookup: {
        from: 'feedbacks',
        let: { technicianId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$toUser', '$$technicianId'] },
                  { $eq: ['$isVisible', true] }
                ]
              }
            }
          }
        ],
        as: 'allFeedbacks'
      }
    },
    {
      $lookup: {
        from: 'feedbacks',
        let: { technicianId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$toUser', '$$technicianId'] },
                  { $eq: ['$isVisible', true] }
                ]
              }
            }
          },
          {
            $lookup: {
              from: 'users',
              let: { fromUserId: '$fromUser' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ['$_id', '$$fromUserId'] }
                  }
                }
              ],
              as: 'customerInfo'
            }
          },
          {
            $project: {
              _id: 1,
              rating: 1,
              content: 1,
              createdAt: 1,
              customerName: { $arrayElemAt: ['$customerInfo.fullName', 0] },
              customerAvatar: { $arrayElemAt: ['$customerInfo.avatar', 0] }
            }
          },
          {
            $sort: { createdAt: -1 }
          }
        ],
        as: 'recentFeedbacks'
      }
    },
    {
      $match: {
        $expr: { $gt: [{ $size: { $ifNull: ["$technicianService", []] } }, 0] }
      }
    }
  ];

  // Thêm favorite lookup nếu có customerId
  if (customerId) {
    pipeline.push({
      $lookup: {
        from: 'favoritetechnicians',
        let: { technicianId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$technicianId', '$$technicianId'] },
                  { $eq: ['$customerId', new mongoose.Types.ObjectId(customerId)] }
                ]
              }
            }
          }
        ],
        as: 'favoriteInfo'
      }
    });
  }

  // Project stage
  pipeline.push({
    $project: {
      _id: 1,
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
      distanceInKm: { $round: [{ $divide: ["$distance", 1000] }, 2] },
      userInfo: { $arrayElemAt: ["$userInfo", 0] },
      category: 1,
      servicePrice: { $arrayElemAt: ["$technicianService.price", 0] },
      warrantyDuration: { $arrayElemAt: ["$technicianService.warrantyDuration", 0] },
      serviceName: { $arrayElemAt: ["$technicianService.serviceName", 0] },
      hasCustomPrice: { $gt: [{ $size: { $ifNull: ["$technicianService", []] } }, 0] },
      isAvailableOnSchedule: { $gt: [{ $size: { $ifNull: ["$availableSchedules", []] } }, 0] },
      inspectionFee: 1,
      totalFeedbacks: { $size: { $ifNull: ["$allFeedbacks", []] } },
      recentFeedbacks: 1,
      isSubscribe: 1,
      subscriptionStatus: 1,
      subscriptionPriority: {
        $switch: {
          branches: [
            { case: { $eq: ["$subscriptionStatus", "PREMIUM"] }, then: 1 }
          ],
          default: 2
        }
      },
      isFavorite: customerId ? { $gt: [{ $size: { $ifNull: ['$favoriteInfo', []] } }, 0] } : false,
      favoritePriority: customerId ? {
        $cond: {
          if: { $gt: [{ $size: { $ifNull: ['$favoriteInfo', []] } }, 0] },
          then: 1,
          else: 2
        }
      } : 2
    }
  });

  // Sort stage
  pipeline.push({
    $sort: customerId ? {
      subscriptionPriority: 1,
      favoritePriority: 1,
      distance: 1
    } : {
      subscriptionPriority: 1,
      distance: 1
    }
  });

  // Limit stage
  pipeline.push({
    $limit: 10
  });

  return pipeline;
};

// Tách logic xử lý kết quả
const processTechnicianResults = (technicians, service, isUrgent) => {
  return technicians.map(technician => {
    const servicePrice = technician.hasCustomPrice ? technician.servicePrice : null;
    const estimatedTime = calculateEstimatedArrivalTime(technician.distanceInKm, isUrgent);
    
    return {
      ...technician,
      servicePrice,
      warrantyDuration: technician.warrantyDuration || 0,
      serviceName: technician.serviceName || service.serviceName || 'Dịch vụ không xác định',
      estimatedArrivalTime: {
        travelTimeInMinutes: estimatedTime.travelTimeInMinutes,
        travelTimeInHours: estimatedTime.travelTimeInHours,
        formattedTime: formatEstimatedTime(estimatedTime.travelTimeInMinutes),
        averageSpeed: estimatedTime.averageSpeed,
        preparationTime: estimatedTime.preparationTime
      }
    };
  });
};

const findNearbyTechnicians = async (searchParams, radiusInKm) => {
  const { serviceId, customerId, latitude, longitude } = searchParams;
  
  try {
    // Debug logging
    console.log('=== DEBUG findNearbyTechnicians ===');
    console.log('searchParams:', JSON.stringify(searchParams, null, 2));
    console.log('radiusInKm:', radiusInKm, 'type:', typeof radiusInKm);
    console.log('latitude:', latitude, 'longitude:', longitude);
    
    // Validation các tham số bắt buộc
    if (!serviceId) {
      throw new Error('serviceId là bắt buộc');
    }
    
    if (!latitude || !longitude) {
      throw new Error('latitude và longitude là bắt buộc');
    }
    
    // Đảm bảo radiusInKm là số dương
    if (radiusInKm && (radiusInKm <= 0 || isNaN(radiusInKm))) {
      throw new Error('radiusInKm phải là số dương');
    }
    
    // Lấy thông tin service
    const service = await Service.findById(serviceId).select('categoryId serviceName').lean();
    if (!service) {
      console.log(`Không tìm thấy service nào với ID: ${serviceId}`);
      return null;
    }

    // Xây dựng query và pipeline
    const matchQuery = buildMatchQuery(searchParams, service.categoryId);
    const pipeline = buildAggregationPipeline(searchParams, matchQuery, customerId);
    
    // Debug logging cho pipeline
    console.log('=== DEBUG Pipeline ===');
    console.log('matchQuery:', JSON.stringify(matchQuery, null, 2));
    console.log('Pipeline length:', pipeline.length);
    console.log('First stage:', JSON.stringify(pipeline[0], null, 2));
    
    // Thực hiện aggregation
    const technicians = await Technician.aggregate(pipeline);
    
    // Xử lý kết quả
    const techniciansWithPricing = processTechnicianResults(technicians, service, searchParams.isUrgent);

    return {
      success: true,
      data: techniciansWithPricing,
      total: techniciansWithPricing.length
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

const confirmJobDoneByTechnician = async (bookingId, userId, role, io) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new Error('Không tìm thấy booking');
    }
    const technician = await Technician.findById(booking.technicianId).populate('userId');
    // console.log('--- TECHNICIAN CONFIRM ---', technician);

    if (role === "TECHNICIAN" && !technician) {
      throw new Error('Không tìm thấy thông tin kỹ thuật viên');
    }
    // console.log('--- TECHNICIAN CONFIRM ID ---', technician?.userId?._id);
    // console.log('--- USER ID ---', userId);

    // Kiểm tra quyền
    if (role === 'CUSTOMER' && booking.customerId.toString() !== userId.toString()) {
      throw new Error('Bạn không có quyền xác nhận booking này');
    }
    if (role === 'TECHNICIAN' && technician?.userId?._id?.toString() !== userId.toString()) {
      throw new Error('Bạn không có quyền xác nhận booking này');
    }

    // Kiểm tra trạng thái hiện tại
    if (booking.status === 'CANCELLED') {
      throw new Error('Booking đã bị hủy trước đó');
    }
    if (booking.status === 'PENDING') {
      throw new Error('Không thể hoàn thành booking khi chưa chọn thợ');
    }
    if (booking.status === 'AWAITING_DONE') {
      throw new Error('Bạn đã xác nhận hoàn thành rồi!!');
    }

    // Cập nhật trạng thái booking
    await Booking.findByIdAndUpdate(
      bookingId,
      {
        $set: {
          status: 'AWAITING_DONE',
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
      toStatus: 'AWAITING_DONE',
      changedBy: userId,
      role
    }], { session });

    io.to(`user:${booking.customerId}`).emit('booking:statusUpdate', {
      bookingId: booking._id,
      status: 'AWAITING_DONE'
    });

    // Gửi thông báo cho khách hàng
    const notifData = {
      userId: booking.customerId,
      title: 'Thợ đã hoàn thành công việc',
      content: `Thợ đã xác nhận hoàn thành công việc cho booking ${booking.bookingCode}. Vui lòng kiểm tra và xác nhận.`,
      referenceModel: 'Booking',
      referenceId: bookingId,
      url: `/booking/booking-processing?bookingId=${bookingId}`,
      type: 'NEW_REQUEST'
    };
    const notify = await notificationService.createNotification(notifData);
    io.to(`user:${notify.userId}`).emit('receiveNotification', notify);

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


  console.log("technicianId:", technicianId, "type:", typeof technicianId);
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
  if (!technicianId || !mongoose.Types.ObjectId.isValid(technicianId)) {
    throw new Error('Invalid or missing technicianId');
  }

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
  // console.log("bookings", bookings);


  // format dữ liệu trả về
  return bookings.map(booking => ({
    bookingId: booking._id,
    bookingCode: booking.bookingCode,
    customerName: booking.customerId?.fullName || 'N/A',
    serviceName: booking.serviceId?.serviceName || 'N/A',
    address: booking.location?.address || 'N/A',
    schedule: booking.schedule,
    status: booking.status
  }));
};


const getEarningsAndCommissionList = async (technicianId) => {
  const quotes = await Booking.find({ technicianId })
    .sort({ createdAt: -1 })
    .populate('customerId', 'fullName')
    .populate('serviceId', 'serviceName');
  console.log("quotes", quotes);

  const earningList = quotes.map(quote => ({
    bookingCode: quote.bookingCode,
    bookingInfo: {
      customerName: quote.customerId?.fullName || 'N/A',
      service: quote.serviceId?.serviceName || 'N/A',
    },
    schedule: {
    start: quote.schedule?.startTime || null,
    expectedEnd: quote.schedule?.expectedEndTime || null,
  },
    finalPrice: quote?.finalPrice || 0,
    holdingAmount: quote?.holdingAmount || 0,
    technicianEarning: quote?.technicianEarning || 0,
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

  const onJobStatuses = ['PENDING', 'AWAITING_CONFIRM', 'IN_PROGRESS', 'WAITING_CUSTOMER_CONFIRM_ADDITIONAL', 'CONFIRM_ADDITIONAL', 'AWAITING_DONE'];
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

// const depositMoney = async (technicianId, amount, paymentMethod) => {
//   if (amount <= 0) {
//     throw new Error('Số tiền nạp phải lớn hơn 0');
//   }

//   const technician = await Technician.findById(technicianId);
//   if (!technician) {
//     throw new Error('Kỹ thuật viên không tồn tại');
//   }

//   const balanceBefore = technician.balance;
//   technician.balance += amount;

//   const log = await DepositLog.create({
//     technicianId,
//     type: 'DEPOSIT',
//     amount,
//     status: 'COMPLETED',
//     paymentMethod,
//     balanceBefore,
//     balanceAfter: technician.balance
//   });

//   await technician.save();

//   return {
//     balanceBefore,
//     balanceAfter: technician.balance,
//     log
//   };
// };

const requestWithdraw = async (technicianId, amount, paymentMethod) => {
  if (amount <= 0) {
    throw new Error('Số tiền rút phải lớn hơn 0');
  }
  console.log('Received technicianId:', technicianId);
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

const getScheduleByTechnicianId = async (technicianId) => {
  try {
    // const technicians = await Technician.find({ status: 'APPROVED' });
    // if (technicians === null) {
    //   console.log('Không tìm thấy thợ ở Đà Nẵng đang thực hiện');
    const schedules = await TechnicianSchedule.find({ technicianId })
      .populate('bookingId')
      .populate({
        path: 'bookingWarrantyId',
        populate: {
          path: 'bookingId', // this is the nested population inside bookingWarrantyId
        },
      })
      .sort({ startTime: 1 });

    if (!schedules || schedules.length === 0) {
      console.log(`Không tìm thấy lịch của kỹ thuật viên với ID: ${technicianId}`);
    }

    return schedules;
  } catch (error) {
    console.log(error.message);
    throw error;
  }
};

const searchTechnicians = async (serviceId, date, time) => {
  // 1. Lấy danh sách thợ cung cấp dịch vụ này
  const technicianServices = await TechnicianService.find({ serviceId: new mongoose.Types.ObjectId(serviceId), isActive: true }).select('technicianId');
  const technicianIds = technicianServices.map(ts => ts.technicianId);

  if (technicianIds.length === 0) {
    return []; // Không có thợ nào cung cấp dịch vụ này
  }

  // 2. Lọc ra những thợ bận vào thời gian đã cho
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const busyTechnicians = await TechnicianSchedule.find({
    technicianId: { $in: technicianIds },
    scheduleType: 'UNAVAILABLE',
    startTime: { $lte: new Date(`${date}T${time}`) },
    endTime: { $gte: new Date(`${date}T${time}`) }
  }).select('technicianId');

  const busyTechnicianIds = busyTechnicians.map(schedule => schedule.technicianId.toString());

  // 3. Lấy danh sách thợ rảnh
  const availableTechnicianIds = technicianIds.filter(id => !busyTechnicianIds.includes(id.toString()));

  if (availableTechnicianIds.length === 0) {
    return []; // Tất cả thợ đều bận
  }

  // 4. Lấy thông tin chi tiết của các thợ rảnh
  const availableTechnicians = await Technician.find({ _id: { $in: availableTechnicianIds } })
    .populate({
      path: 'userId',
      select: 'fullName avatar'
    })
    .select('ratingAverage experienceYears jobCompleted');

  return availableTechnicians;
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
  confirmJobDoneByTechnician,
  getTechnicianById,
  findTechnicianByUserId,
  getListBookingForTechnician,
  createNewTechnician,
  findTechnicianByUserId,
  getTechnicianDepositLogs,
  requestWithdraw,
  getTechnicianDepositLogs,
  searchTechnicians,
  getScheduleByTechnicianId,
  calculateEstimatedArrivalTime,
  formatEstimatedTime
};
