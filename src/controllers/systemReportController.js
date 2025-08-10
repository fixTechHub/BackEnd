const systemReportService = require('../services/systemReportService');

// Create a system report
exports.createSystemReport = async (req, res) => {
  try {
    const submittedBy = req.user.userId;
    const { title, tag, description } = req.body;

    const report = await systemReportService.createSystemReport({ submittedBy, title, tag, description });

    return res.status(201).json({ success: true, message: 'Gửi báo cáo hệ thống thành công', data: report });
  } catch (error) {
    console.error('Create SystemReport Error:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

// Get system report detail by id
exports.getSystemReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await systemReportService.getSystemReportById(id);
    return res.status(200).json({ success: true, data: report });
  } catch (error) {
    console.error('Get SystemReport Error:', error);
    return res.status(404).json({ success: false, message: error.message });
  }
};

// Get list with filters (admin)
exports.getSystemReportList = async (req, res) => {
  try {
    const { status, tag, search, page, limit } = req.query;
    const result = await systemReportService.getSystemReportList({ status, tag, search, page: Number(page) || 1, limit: Number(limit) || 10 });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('List SystemReport Error:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

// Update status (admin)
exports.updateSystemReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNote } = req.body;
    const adminId = req.user.userId;

    const report = await systemReportService.updateSystemReportStatus({ id, status, resolvedBy: adminId, resolutionNote });
    return res.status(200).json({ success: true, message: 'Cập nhật trạng thái thành công', data: report });
  } catch (error) {
    console.error('Update SystemReport Status Error:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
};
