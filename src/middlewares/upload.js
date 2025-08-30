const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),  // lưu tạm vào RAM để xử lý (upload S3)
  limits: {
    files: 5,                       // tối đa 5 file
    fileSize: 8 * 1024 * 1024,       // 8MB mỗi file
  },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
    }
  },
});
module.exports = {
    upload
};

