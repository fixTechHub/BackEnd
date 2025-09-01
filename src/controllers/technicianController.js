const technicianService = require('../services/technicianService');
const User = require('../models/User');
const Technician = require('../models/Technician');
const Certificate = require('../models/Certificate');
const { deleteFileFromS3, uploadFileToS3 } = require('../services/s3Service');
const TechnicianService = require('../models/TechnicianService');
const contractService = require('../services/contractService');
const notificationService = require('../services/notificationService');
const { getIo } = require('../sockets/socketManager');
const { generateToken, generateRefreshToken } = require('../utils/jwt');
const { generateCookie } = require('../utils/generateCode');
// const sendQuotation = async (req, res) => {
//   try {
//     const userId = req.user.userId;
//     console.log('USERID', userId);

//     const { bookingId, laborPrice, items, warrantiesDuration } = req.body;
//     const bookingPriceData = {
//       bookingId,
//       userId,
//       laborPrice,
//       warrantiesDuration,
//       items
//     };

//     const result = await technicianService.sendQuotation(bookingPriceData);
//     res.status(200).json(result);
//   } catch (error) {
//     console.error('Error sending quotation:', error);
//     res.status(500).json({ message: 'Failed to send quotation', error: error.message });
//   }
// };

const confirmJobDoneByTechnician = async (req, res) => {
  try {
    const { bookingId } = req.params;
    console.log('ui', req.user.userId);

    const userId = req.user.userId;
    const role = req.user.role;
    // const role = 'TECHNICIAN'

    const io = getIo();

    const booking = await technicianService.confirmJobDoneByTechnician(
      bookingId,
      userId,
      role,
      io
    );

    res.status(200).json({
      success: true,
      message: 'Xác nhận thành công',
      data: booking
    });
  } catch (error) {
    console.error('Lỗi khi xác nhận hoàn thành:', error);
    res.status(500).json({
      success: false,
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
    const result = await contractService.generateContractOnRegistration(technician._id, session);

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
    // const { technicianId } = req.auth || {};

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
    const { technicianId } = req.params || {};
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

    res.status(200).json({
      message: 'Lấy thông tin thợ thành công',
      data: technician
    });
  } catch (error) {

  }
};

const getTechnicianDepositLogs = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 20, skip = 0 } = req.query;
    const technicianDepositLogs = await technicianService.getTechnicianDepositLogs(userId, parseInt(limit), parseInt(skip));
    res.status(200).json({
      technicianDepositLogs
    });
  } catch (error) {
    console.error('Error in getTechnicianDepositLogs:', error.message, error.stack);
    res.status(500).json({ success: false, message: error.message });
  }
};

// module.exports = { getTechnicianDepositLogs };

// const depositMoney = async (req, res, next) => {
//   try {
//     const { technicianId, amount, paymentMethod } = req.body;

//     const result = await technicianService.depositMoney(
//       technicianId,
//       amount,
//       paymentMethod
//     );

//     res.status(200).json({
//       success: true,
//       message: 'Nạp tiền thành công',
//       data: result
//     });
//   } catch (error) {
//     console.error("Error:", error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

const requestWithdraw = async (req, res, next) => {
  try {
    const { amount, paymentMethod, technicianId } = req.body;

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
  const session = await Technician.db.startSession();
  session.startTransaction();
  const uploadedUrls = []; // thu thập để xoá nếu rollback

  try {
    const userId = req.user.userId;

    // Role check
    const user = await User.findById(userId).populate('role');
    if (!user || user.role?.name !== 'TECHNICIAN') {
      throw new Error('Chỉ kỹ thuật viên mới có thể hoàn thành hồ sơ này');
    }

    const existingTechnician = await Technician.findOne({ userId }).session(session);
    if (existingTechnician) {
      throw new Error('Hồ sơ kỹ thuật viên đã tồn tại');
    }

    // Lấy file từ req.files (multer.fields)
    const fileObj = req.files || {};
    const frontArr = fileObj.frontIdImage || [];
    const backArr = fileObj.backIdImage || [];
    const businessLicenseArr = fileObj.businessLicenseImage || [];
    const certArr = fileObj.certificates || [];

    // Handle different account types
    let frontUrl = null, backUrl = null, businessLicenseUrl = null;
    
    if (user.accountType === 'BUSINESS') {
      // Business account: require tax code and business license
      if (!req.body.taxCode || req.body.taxCode.trim() === '') {
        throw new Error('Mã số thuế là bắt buộc cho doanh nghiệp');
      }
      if (businessLicenseArr.length === 0) {
        throw new Error('Giấy đăng ký kinh doanh là bắt buộc cho doanh nghiệp');
      }
      businessLicenseUrl = await uploadFileToS3(
        businessLicenseArr[0].buffer, 
        businessLicenseArr[0].originalname, 
        businessLicenseArr[0].mimetype, 
        'technicians'
      );
    } else {
      // Individual account: require CCCD
      if (frontArr.length === 0 || backArr.length === 0) {
        throw new Error('Thiếu ảnh CCCD bắt buộc');
      }
      frontUrl = await uploadFileToS3(frontArr[0].buffer, frontArr[0].originalname, frontArr[0].mimetype, 'technicians');
      backUrl = await uploadFileToS3(backArr[0].buffer, backArr[0].originalname, backArr[0].mimetype, 'technicians');
    }

    // Upload certificates (common for both account types)
    const certUrls = await Promise.all(certArr.map(f => uploadFileToS3(f.buffer, f.originalname, f.mimetype, 'technicians')));

    // Gom url để rollback nếu cần
    if (frontUrl) uploadedUrls.push(frontUrl);
    if (backUrl) uploadedUrls.push(backUrl);
    if (businessLicenseUrl) uploadedUrls.push(businessLicenseUrl);
    uploadedUrls.push(...certUrls);

    // Debug: log received data
    console.log('Received form data:', {
        address: req.body.address,
        currentLocation: req.body.currentLocation,
        identification: req.body.identification,
        experienceYears: req.body.experienceYears
    });

    // Build data
    const technicianBody = {
      ...req.body,
      frontIdImage: frontUrl,
      backIdImage: backUrl,
      businessLicenseImage: businessLicenseUrl,
      taxCode: user.accountType === 'BUSINESS' ? req.body.taxCode : undefined,
      certificate: certUrls,
      specialtiesCategories: req.body.specialtiesCategories ? JSON.parse(req.body.specialtiesCategories) : [],
      bankAccount: req.body.bankAccount ? JSON.parse(req.body.bankAccount) : undefined,
      currentLocation: req.body.currentLocation ? JSON.parse(req.body.currentLocation) : {
        type: 'Point',
        coordinates: [0, 0]
      },
      // The front-end may omit inspectionFee; default to 0 in that case.
      inspectionFee: req.body.inspectionFee !== undefined ? Number(req.body.inspectionFee) : 0
    };

    // Debug: Log data being sent to technicianService
    console.log('📋 [Technician] Creating technician with data:', {
      userId,
      accountType: user.accountType,
      hasIdentification: !!technicianBody.identification,
      hasFrontIdImage: !!technicianBody.frontIdImage,
      hasBackIdImage: !!technicianBody.backIdImage,
      hasTaxCode: !!technicianBody.taxCode,
      hasBusinessLicenseImage: !!technicianBody.businessLicenseImage,
      taxCodeValue: technicianBody.taxCode,
      businessLicenseUrl: technicianBody.businessLicenseImage,
      specialtiesCount: technicianBody.specialtiesCategories?.length || 0,
      hasBankAccount: !!technicianBody.bankAccount
    });

    const technician = await technicianService.createNewTechnician(userId, technicianBody, session);
    
    console.log('✅ [Technician] Created technician with ID:', technician._id);

    // Lưu giá dịch vụ & thời gian bảo hành (TechnicianService)
    if (req.body.serviceDetails) {
      const parsedDetails = typeof req.body.serviceDetails === 'string' ? JSON.parse(req.body.serviceDetails) : req.body.serviceDetails;

      const serviceDocs = Object.entries(parsedDetails).map(([serviceId, detail]) => ({
        technicianId: technician._id,
        serviceId,
        price: Number(detail.price) || 0,
        warrantyDuration: Number(detail.warranty) || 0,
        isActive: true,
      }));

      if (serviceDocs.length) {
        await TechnicianService.insertMany(serviceDocs, { session });
      }
    }

    // Update user status and address
    user.status = 'ACTIVE';
    
    // Update user address if provided
    if (req.body.address && req.body.address.trim()) {
        // Parse address string into structured format
        // For simplicity, store the full address as street for now
        user.address = {
            street: req.body.address.trim(),
            city: 'Đà Nẵng', // Default city for this project
            district: '' // Can be enhanced later
        };
        console.log('Updated user address:', user.address);
    }
    
    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Generate new JWT token with updated user data
    await user.populate('role');
    
    const newToken = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);
    generateCookie(newToken, res, newRefreshToken);

    res.status(201).json({ success: true, message: 'Hoàn thành hồ sơ kỹ thuật viên thành công', data: technician });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    // rollback: xoá file đã upload để tránh rác
    for (const url of uploadedUrls) {
      try { await deleteFileFromS3(url); } catch (_) { }
    }

    console.error('Error completing technician profile:', error);
    res.status(400).json({ success: false, message: error.message });
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
    if (!req.s3FileUrl) {
      return res.status(400).json({
        success: false,
        message: 'Không có file được upload'
      });
    }

    const newCertificate = await Certificate.create({
      technicianId: userId,        // gán userId là người upload
      fileUrl: req.s3FileUrl,
      status: 'PENDING'            // trạng thái mặc định
    });

    res.status(200).json({
      success: true,
      message: 'Upload chứng chỉ thành công',
      fileUrl: req.s3FileUrl,
      certificate: newCertificate
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

const uploadCCCDImages = async (req, res) => {
  try {
    const userId = req.user.userId;
    // Kiểm tra user là technician
    const user = await User.findById(userId).populate('role');
    if (!user || user.role?.name !== 'TECHNICIAN') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ kỹ thuật viên mới có thể upload ảnh CCCD'
      });
    }
    // Lấy URL từ req.s3FileUrls (do processAndUploadToS3 gắn vào)
    const frontUrl = req.s3FileUrls?.frontIdImage?.[0] || null;
    const backUrl = req.s3FileUrls?.backIdImage?.[0] || null;
    if (!frontUrl || !backUrl) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu ảnh mặt trước hoặc mặt sau CCCD'
      });
    }
    // Cập nhật vào model Technician
    const technician = await Technician.findOneAndUpdate(
      { userId: userId },
      { frontIdImage: frontUrl, backIdImage: backUrl },
      { new: true }
    );
    if (!technician) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy kỹ thuật viênviên'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Upload ảnh CCCD thành công',
      frontIdImage: frontUrl,
      backIdImage: backUrl
    });
  } catch (error) {
    console.error('Error uploading CCCD images:', error);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi upload ảnh CCCD',
      error: error.message
    });
  }
};


const getSchedulesOfTechnician = async (req, res, next) => {
  try {
    const { technicianId } = req.params;

    const schedules = await technicianService.getScheduleByTechnicianId(technicianId);

    res.status(200).json({
      success: true,
      message: 'Lấy lịch kỹ thuật viên thành công',
      count: schedules?.length || 0,
      data: schedules || []
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const searchTechnicians = async (req, res) => {
  try {
    const { serviceId, date, time } = req.body;

    if (!serviceId || !date || !time) {
      return res.status(400).json({
        message: 'Vui lòng cung cấp đủ thông tin dịch vụ, ngày và giờ'
      });
    }

    const technicians = await technicianService.searchTechnicians(serviceId, date, time);

    res.status(200).json({
      message: 'Tìm kiếm thợ thành công',
      data: technicians
    });
  } catch (error) {
    console.error('Error searching technicians:', error);
    res.status(500).json({
      message: 'Lỗi server khi tìm kiếm thợ',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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
  confirmJobDoneByTechnician,
  updateAvailability,
  getTechnicianInformation,
  viewTechnicianBookings,
  completeTechnicianProfile,
  uploadCertificate,
  uploadCCCDImages,
  getTechnicianDepositLogs,
  requestWithdraw,
  getSchedulesOfTechnician,
  searchTechnicians
};
