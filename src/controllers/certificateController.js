const Certificate = require('../models/Certificate');
const { deleteFileFromS3 } = require('../services/s3Service');
const CertificateService = require('../services/certificateService');


const uploadCertificate = async (req, res) => {
  try {
    const { technicianId } = req.params;
    const fileUrl = req.s3FileUrl;

    console.log('Technician ID:', technicianId);
    console.log('S3 File URL:', fileUrl);

    if (!technicianId || !fileUrl) {
      return res.status(400).json({ message: 'Technician ID and file are required' });
    }

    const certificate = await Certificate.create({
      technicianId,
      fileUrl,
      status: 'PENDING',
    });

    res.status(201).json({
      message: 'Certificate uploaded successfully',
      certificate,
    });
  } catch (error) {
    console.error('Upload certificate error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const deleteCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('➡️ ID cần xoá:', id);
    const certificate = await Certificate.findById(id);

    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }

    await deleteFileFromS3(certificate.fileUrl);

    await certificate.deleteOne();

    res.status(200).json({ message: 'Certificate deleted successfully' });
  } catch (error) {
    console.error('Delete certificate error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const verifyCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;
    const { status, rejectionReason } = req.body;

    const certificate = await CertificateService.verifyCertificate(
      certificateId,
      status,
      rejectionReason
    );

    res.status(200).json({
      message: `Certificate ${status.toLowerCase()}`,
      certificate
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  uploadCertificate,
  deleteCertificate,
  verifyCertificate
};
