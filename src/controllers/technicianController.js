const technicianService = require('../services/technicianService');
const User = require('../models/User');
const Technician = require('../models/Technician');
const { populate } = require('../models/Booking');

const sendQuotation = async (req, res) => {
  try {
    // const technicianId = req.user._id;
    const { bookingId, technicianId, laborPrice, items, warrantiesDuration } = req.body;
    const bookingPriceData = {
      bookingId,
      technicianId,
      laborPrice,
      warrantiesDuration,
      items
    };

    const result = await technicianService.sendQuotation(bookingPriceData);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error sending quotation:', error);
    res.status(500).json({ message: 'Failed to send quotation', error: error.message });
  }
};

const confirmJobDoneByTechnician = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { userId } = req.body;
    // const userId = req.user._id;
    // const role = req.user.role.name;
    const technician = await Technician.findOne({ userId: userId }).populate({ path: 'userId', populate: { path: 'role', model: require('../models/Role') } });
    console.log(technician)
    const role = technician.userId.role.name;

    const booking = await technicianService.confirmJobDoneByTechnician(
      bookingId,
      technician._id,
      role
    );

    res.status(200).json({
      message: 'Xác nhận thành công',
      data: booking
    });
  } catch (error) {
    console.error('Lỗi khi xác nhận hoàn thành:', error);
    res.json({
      message: error.message || 'Không thể xác nhận hoàn thành'
    });
  }
};

const viewTechnicianProfile = async (req, res) => {
  try {
    const { technicianId } = req.params;

    const technician = await Promise.all([
      technicianService.getTechnicianProfile(technicianId),
      technicianService.getCertificatesByTechnicianId(technicianId) // Sửa đúng
    ]);

    res.json({
      success: true,
      data: technician,
    });
  } catch (error) {
    console.error('Error fetching technician profile:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

const getCertificatesByTechnicianId = async (req, res) => {
  try {
    const { technicianId } = req.params;
    const certificates = await technicianService.getCertificatesByTechnicianId(technicianId);
    res.status(200).json({
      message: 'Certificates fetched successfully',
      certificates,
    });
  } catch (error) {
    console.error('Get certificates error:', error);
    res.status(error.status || 500).json({ message: error.message || 'Internal server error' });
  }
};


const registerAsTechnician = async (req, res, next) => {
  try {
    const technician = await technicianService.registerAsTechnician(req.body);
    res.status(201).json({
      message: 'Technician registration submitted. Waiting for admin approval.',
      technician,
    });
  } catch (error) {
    next(error);
  }
};


const viewJobDetails = async (req, res) => {
  try {
    const { technicianId, bookingId } = req.params;
    console.log("bookingId:", bookingId);
    console.log("technicianId:", technicianId);

    const booking = await technicianService.getJobDetails(bookingId, technicianId);

    res.status(200).json(booking);
  } catch (error) {
    console.error(error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }

    res.status(500).json({ message: 'Server error' });
  }
}

const viewEarningsByBooking = async (req, res) => {
  try {
    const technicianId = req.params;

    const earningList = await technicianService.getEarningsAndCommissionList(technicianId);

    res.json({
      success: true,
      data: earningList
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getTechnicianAvailability = async (req, res) => {
  try {
    const technicianId = req.params.technicianId;

    const availability = await technicianService.getAvailability(technicianId);

    return res.status(200).json({
      success: true,
      availability
    });
  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateAvailability = async (req, res) => {
  try {
    const technicianId = req.params.technicianId;

    const updatedTech = await technicianService.updateTechnicianAvailability(technicianId);

    if (!updatedTech) {
      return res.status(404).json({ success: false, message: 'Technician not found' });
    }

    res.status(200).json({ success: true, data: updatedTech });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  registerAsTechnician,
  viewTechnicianProfile,
  getCertificatesByTechnicianId,
  viewJobDetails,
  viewEarningsByBooking,
  getTechnicianAvailability,
  sendQuotation,
  confirmJobDoneByTechnician,
  updateAvailability
};
