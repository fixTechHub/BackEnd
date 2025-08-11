const express = require('express');
const router = express.Router();
const { handleMulter, processAndUploadToS3 } = require('../middlewares/uploadMiddleware'); 
const { uploadCertificate, deleteCertificate, verifyCertificate, getAllCertificates } = require('../controllers/certificateController');
const { authenticateToken } = require('../middlewares/authMiddleware');


router.get('/', getAllCertificates);
router.post(
  '/:technicianId/upload',
  handleMulter.single('file'),                 
  processAndUploadToS3('certificates'),        
  uploadCertificate                             
);

router.delete('/:id', deleteCertificate);
router.patch('/:certificateId/verify',verifyCertificate);


module.exports = router;