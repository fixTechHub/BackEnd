const Technician = require('../models/Technician');
const User = require('../models/User');
const Certificate = require('../models/Certificate');
const Booking = require('../models/Booking');
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


module.exports = {
  registerAsTechnician,
  getTechnicianProfile,
  getCertificatesByTechnicianId,
  getJobDetails
};
