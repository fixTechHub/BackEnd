const mongoose = require('mongoose');
const SystemReport = require('../models/SystemReport');

/**
 * Create a new system report
 * @param {Object} payload
 * @param {String} payload.submittedBy  - User _id (ObjectId string)
 * @param {String} payload.title        - Report title
 * @param {String} payload.tag          - One of enum ['SYSTEM','PAYMENT','UI','OTHER']
 * @param {String} payload.description  - Detailed description
 */
async function createSystemReport({ submittedBy, title, tag, description }) {
  // Rate-limit: 5 per day / user
  const DAILY_LIMIT = 5;
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const todayCount = await SystemReport.countDocuments({
    submittedBy,
    createdAt: { $gte: dayStart },
  });

  if (todayCount >= DAILY_LIMIT) {
    throw new Error('Bạn đã đạt giới hạn gửi báo cáo hôm nay, vui lòng thử lại vào ngày mai');
  }

  const report = await SystemReport.create({ submittedBy, title, tag, description });
  return report;
}

/**
 * Get system report detail
 * @param {String} id
 */
async function getSystemReportById(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('ID báo cáo không hợp lệ');
  }
  const report = await SystemReport.findById(id).populate('submittedBy', 'fullName email role avatar').populate('resolvedBy', 'fullName email role avatar');
  if (!report) {
    throw new Error('Không tìm thấy báo cáo');
  }
  return report;
}

/**
 * Query list of system reports with pagination & filters
 * @param {Object} queryParams
 *  - status, tag, search, page, limit
 */
async function getSystemReportList({ status, tag, search, page = 1, limit = 10 }) {
  const filter = {};
  if (status) filter.status = status.toUpperCase();
  if (tag) filter.tag = tag.toUpperCase();

  if (search) {
    const regex = new RegExp(search, 'i');
    filter.$or = [{ title: regex }, { description: regex }];
  }

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    SystemReport.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('submittedBy', 'fullName')
      .populate('resolvedBy', 'fullName'),
    SystemReport.countDocuments(filter),
  ]);

  return { items, total, page, limit };
}

/**
 * Update status of a system report (admin)
 * @param {String} id
 * @param {String} status - New status (IN_PROGRESS | RESOLVED | REJECTED)
 * @param {String} resolvedBy - admin user id
 * @param {String} resolutionNote - optional note
 */
async function updateSystemReportStatus({ id, status, resolvedBy, resolutionNote }) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new Error('ID báo cáo không hợp lệ');

  const allowed = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];
  if (!allowed.includes(status)) throw new Error('Trạng thái không hợp lệ');

  const update = { status };
  if (status === 'RESOLVED' || status === 'REJECTED') {
    update.resolvedBy = resolvedBy;
    update.resolutionNote = resolutionNote || '';
    update.resolvedAt = new Date();
  }

  const report = await SystemReport.findByIdAndUpdate(id, update, { new: true });
  if (!report) throw new Error('Không tìm thấy báo cáo');

  return report;
}

module.exports = {
  createSystemReport,
  getSystemReportById,
  getSystemReportList,
  updateSystemReportStatus,
};
