const mongoose = require('mongoose');
const Report = require('../models/Report');
const Booking = require('../models/Booking');
const BookingWarranty = require('../models/BookingWarranty');
const Role = require('../models/Role');
const User = require('../models/User');
const notificationService =require('./notificationService')
/**
 * Create a new report by customer or technician
 * @param {Object} payload - report data from controller
 */
exports.createReport = async (payload) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Ensure booking or warranty exists
    if (payload.bookingId) {
      const booking = await Booking.findById(payload.bookingId).session(session);
      if (!booking) {
        throw new Error('Booking không tồn tại');
      }
    } else if (payload.warrantyId) {
      const warranty = await BookingWarranty.findById(payload.warrantyId).session(session);
      if (!warranty) {
        throw new Error('Warranty không tồn tại');
      }
    } else {
      throw new Error('Yêu cầu phải có bookingId hoặc warrantyId');
    }

    // Check duplicate active report
    const activeStatuses = ['PENDING', 'AWAITING_RESPONSE'];
    const duplicateQuery = {
      reporterId: payload.reporterId,
      reportedUserId: payload.reportedUserId,
      status: { $in: activeStatuses },
    };
    if (payload.bookingId) duplicateQuery.bookingId = payload.bookingId;
    if (payload.warrantyId) duplicateQuery.warrantyId = payload.warrantyId;

    const duplicate = await Report.findOne(duplicateQuery).session(session);

    if (duplicate) {
      throw new Error('Bạn đã gửi báo cáo này và nó đang được xử lý');
    }

    // Rate limit: max 5 reports per day per user
    const DAILY_LIMIT = 5;
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const todayCount = await Report.countDocuments({
      reporterId: payload.reporterId,
      createdAt: { $gte: dayStart },
    }).session(session);

    if (todayCount >= DAILY_LIMIT) {
      throw new Error('Bạn đã đạt giới hạn gửi báo cáo hôm nay, vui lòng thử lại vào ngày mai');
    }

    // Build report data
    const reportData = {
      bookingId: payload.bookingId || undefined,
      warrantyId: payload.warrantyId || undefined,
      reporterId: payload.reporterId,
      reportedUserId: payload.reportedUserId,
      type: payload.warrantyId ? 'WARRANTY' : 'BOOKING',
      title: payload.title,
      tag: payload.tag,
      description: payload.description,
      evidences: payload.evidences || [],
      status: 'PENDING',
      // 24h to respond by default (can be changed later)
      responseDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      responseLocked: false,
    };

    const report = await Report.create([reportData], { session });
    const adminRole = await Role.findOne({ name: 'ADMIN' });
    if (!adminRole) {
      throw new Error('Admin role not found');
    }

    const admins = await User.find({ role: adminRole._id, status: 'ACTIVE' });
    for (const admin of admins) {
      const adminNotificationData = {
        userId: admin._id,
        title: payload.title,
        content: `Thợ  đã bị báo cáo vì lí do ${payload.description}.`,
        referenceId: payload.reportedUserId,
        referenceModel: 'User',
        type: 'NEW_REQUEST',
        // url: 'warranty'
      };
      await notificationService.createAndSend(adminNotificationData, session);

    }
    await session.commitTransaction();
    session.endSession();

    // report is an array (bulkWrite style). return first element
    return report[0];
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

exports.getReportById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('ID báo cáo không hợp lệ');
  }
  const report = await Report.findById(id)
    .populate('reporterId', 'fullName email role avatar')
    .populate('reportedUserId', 'fullName email role avatar');
  if (!report) {
    throw new Error('Không tìm thấy báo cáo');
  }
  return report;
};