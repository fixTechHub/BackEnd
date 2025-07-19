const reportService = require('../services/reportService');

// Create a report (customer or technician)
exports.createReport = async (req, res) => {
  try {
    const reporterId = req.user.userId;
    const {
      bookingId,
      reportedUserId,
      title,
      tag,
      description,
      evidences = [],
    } = req.body;

    const report = await reportService.createReport({
      bookingId,
      reporterId,
      reportedUserId,
      title,
      tag,
      description,
      evidences,
    });

    return res.status(201).json({
      success: true,
      message: 'Gửi báo cáo thành công',
      data: report,
    });
  } catch (error) {
    console.error('Create Report Error:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

// Get report detail
exports.getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await reportService.getReportById(id);
    return res.status(200).json({ success: true, data: report });
  } catch (error) {
    console.error('Get Report Error:', error);
    return res.status(404).json({ success: false, message: error.message });
  }
};
