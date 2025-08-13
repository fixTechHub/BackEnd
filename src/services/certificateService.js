const Certificate = require('../models/Certificate');

const listCertificates = async ({ search, status, page = 1, limit = 10 }) => {
  const query = {};
  if (status && ['PENDING','APPROVED','REJECTED'].includes(status)) query.status = status;

  const all = await Certificate.find(query)
    .populate({
      path: 'technicianId',
      select: 'userId',
      populate: { path: 'userId', select: 'fullName email' },
    })
    .sort({ createdAt: -1 })
    .lean();

  // filter search ở app layer (không regex)
  let rows = all;
  if (search && search.trim()) {
    const s = search.trim().toLowerCase();
    rows = all.filter(c => {
      const name  = (c?.technicianId?.userId?.fullName || '').toLowerCase();
      const email = (c?.technicianId?.userId?.email || '').toLowerCase();
      const url   = (c?.fileUrl || '').toLowerCase();
      return name.includes(s) || email.includes(s) || url.includes(s);
    });
  }

  const total = rows.length;
  const start = (page - 1) * limit;
  return {
    items: rows.slice(start, start + limit),
    page, limit, total,
    totalPages: Math.ceil(total / limit),
  };
};

// services/certificate.service.js
const verifyCertificate = async ({ certificateId, status, reason = '', adminUserId }) => {
  if (!['APPROVED','REJECTED'].includes(status)) throw new Error('Invalid status value');

  const update = {
    status,
    verifiedBy: adminUserId,
    verifiedAt: new Date(),
    rejectionReason: status === 'REJECTED' ? reason : undefined,
  };

  const cert = await Certificate.findByIdAndUpdate(certificateId, update, { new: true });
  if (!cert) throw new Error('Certificate not found');
  return cert;
};



module.exports = { listCertificates ,verifyCertificate };