const Technician = require('../models/Technician');
const User = require('../models/User');
const Certificate = require('../models/Certificate');
const Booking = require('../models/Booking');
const BookingPrice = require('../models/BookingPrice');
const CommissionConfig = require('../models/CommissionConfig');
const Service = require('../models/Service');
const mongoose = require('mongoose');



const getTechnicianProfile = async (technicianId) => {
  const technician = await Technician.findById(technicianId)
    .populate('userId')  // Populate để lấy thông tin User
    .populate('specialtiesCategories');  // Nếu muốn lấy luôn categories (nếu có)

  console.log(technician);
  if (!technician) {
    throw new Error('Technician not found');
  }

  return technician;
};

const getCertificatesByTechnicianId = async (technicianId) => {
  if (!technicianId || !mongoose.Types.ObjectId.isValid(technicianId)) {
    throw { status: 400, message: 'Invalid technician ID' };
  }

  const certificates = await Certificate.find({ technicianId }).sort({ createdAt: -1 });

  if (!certificates || certificates.length === 0) {
    throw { status: 404, message: 'No certificates found for this technician' };
  }

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

  // if (!booking.technicianId || booking.technicianId.toString() !== technicianId.toString()) {
  //     throw { status: 403, message: 'You are not allowed to view this booking' };
  // }

  return booking;
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

  //   const earningList = quotes.map(quote => {
  //   const finalPrice = quote.finalPrice || 0;

  //   const config = quote.commissionConfigId;
  //   const commissionPercent = config?.commissionPercent || 0;
  //   const holdingPercent = config?.holdingPercent || 0;

  //   let commissionAmount = 0;
  //   if (config?.commissionType === 'PERCENT') {
  //     commissionAmount = (finalPrice * commissionPercent) / 100;
  //   } else if (config?.commissionType === 'MIN_AMOUNT') {
  //     commissionAmount = config?.commissionMinAmount || 0;
  //   }

  //   const holdingAmount = (finalPrice * holdingPercent) / 100;
  //   const technicianEarning = finalPrice - commissionAmount - holdingAmount;

  //   return {
  //     bookingId: quote.bookingId?._id,
  //     bookingInfo: {
  //       customerName: quote.bookingId?.customerId?.name || 'N/A',
  //       service: quote.bookingId?.service || 'N/A',
  //     },
  //     finalPrice,
  //     commissionAmount,
  //     holdingAmount,
  //     technicianEarning,
  //   };
  // });

  // return earningList;

  const earningList = quotes.map(quote => ({
    bookingId: quote.bookingId._id,
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



module.exports = {
  registerAsTechnician,
  getTechnicianProfile,
  getCertificatesByTechnicianId,
  getJobDetails,
  getEarningsAndCommissionList,
  getAvailability,
  updateTechnicianAvailability
};
