const Certificate = require('../models/Certificate');

const verifyCertificate = async (certificateId, status, reason = null) => {
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    throw new Error('Invalid status value');
  }

  const update = { status };
  if (status === 'REJECTED') {
    update.rejectionReason = reason;
  }

  const certificate = await Certificate.findByIdAndUpdate(
    certificateId,
    update,
    { new: true }
  );

  if (!certificate) {
    throw new Error('Certificate not found');
  }

  return certificate;
};

module.exports = { verifyCertificate };