const technicianService = require('../services/technicianService');
const User = require('../models/User');
const Technician = require('../models/Technician');

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
    const userId = req.user.userId;
    const role = req.user.role;

    const booking = await technicianService.confirmJobDoneByTechnician(
      bookingId,
      userId,
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

    const [technician, certificates] = await Promise.all([
      technicianService.getTechnicianProfile(technicianId),
      technicianService.getCertificatesByTechnicianId(technicianId) // Sửa đúng
    ]);

    res.json({
      success: true,
      data: {
        technician,
        certificates: (certificates && certificates.length > 0) ? certificates : null
      }


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

const viewTechnicianBookings = async (req, res, next) => {
  try {
    const { technicianId } = req.params;

    const bookings = await technicianService.getListBookingForTechnician(technicianId);

    res.json({
      success: true,
      data: bookings
    });
  } catch (err) {
    next(err);
  }
};

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

const getTechnicianInformation = async (req, res) => {
  try {
    const technicianId = req.params.technicianId;

    const technician = await technicianService.getTechnicianInformation(technicianId);
    console.log('--- TECHNICIAN ---', technician);

    res.status(200).json({
      message: 'Lấy thông tin thợ thành công',
      data: technician
    });
  } catch (error) {

  }
};

const depositMoney = async (req, res, next) => {
  try {
    const { technicianId, amount, paymentMethod } = req.body;

    const result = await technicianService.depositMoney(
      technicianId,
      amount,
      paymentMethod
    );

    res.status(200).json({
      success: true,
      message: 'Nạp tiền thành công',
      data: result
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const requestWithdraw = async (req, res, next) => {
  try {
    const { technicianId, amount, paymentMethod } = req.body;

    const result = await technicianService.requestWithdraw(
      technicianId,
      amount,
      paymentMethod
    );

    res.status(200).json({
      success: true,
      message: 'Yêu cầu rút tiền đã gửi đến admin',
      data: result
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


const completeTechnicianProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const technicianData = req.body;

    // Kiểm tra xem user có phải là technician không
    const user = await User.findById(userId).populate('role');
    if (!user || user.role?.name !== 'TECHNICIAN') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ kỹ thuật viên mới có thể hoàn thành hồ sơ này'
      });
    }

    // Kiểm tra xem đã có technician profile chưa
    const existingTechnician = await Technician.findOne({ userId: userId });
    if (existingTechnician) {
      return res.status(400).json({
        success: false,
        message: 'Hồ sơ kỹ thuật viên đã tồn tại'
      });
    }

    // Tạo technician profile
    const technician = await technicianService.createNewTechnician(userId, technicianData);

    // Cập nhật status user thành ACTIVE
    user.status = 'ACTIVE';
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Hoàn thành hồ sơ kỹ thuật viên thành công',
      data: technician
    });
  } catch (error) {
    console.error('Error completing technician profile:', error);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi hoàn thành hồ sơ',
      error: error.message
    });
  }
};

const uploadCertificate = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Kiểm tra xem user có phải là technician không
    const user = await User.findById(userId).populate('role');
    if (!user || user.role?.name !== 'TECHNICIAN') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ kỹ thuật viên mới có thể upload chứng chỉ'
      });
    }

    // File đã được upload bởi middleware và URL đã được gắn vào req.fileUrl
    if (!req.fileUrl) {
      return res.status(400).json({
        success: false,
        message: 'Không có file được upload'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Upload chứng chỉ thành công',
      fileUrl: req.fileUrl
    });
  } catch (error) {
    console.error('Error uploading certificate:', error);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi upload chứng chỉ',
      error: error.message
    });
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
  updateAvailability,
  getTechnicianInformation,
  viewTechnicianBookings,
  depositMoney,
  requestWithdraw,
  completeTechnicianProfile,
  uploadCertificate,
};
