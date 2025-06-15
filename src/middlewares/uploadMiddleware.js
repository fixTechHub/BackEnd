const multer = require('multer');
const { uploadFileToS3 } = require('../services/s3Service');

const storage = multer.memoryStorage();
const handleMulter = multer({ storage: storage });

/**
 * Middleware để upload file lên S3 và gắn URL vào request.
 * @param {string} destinationFolder - Thư mục đích trên S3.
 */
const processAndUploadToS3 = (destinationFolder) => {
    // Hàm này BẮT BUỘC phải là async
    return async (req, res, next) => {
        if (!req.file && !req.files) {
            return next();
        }

        try {
            // Xử lý nhiều file
            if (req.files && req.files.length > 0) {
                const uploadPromises = req.files.map(file =>
                    uploadFileToS3(file.buffer, file.originalname, file.mimetype, destinationFolder)
                );

                // Chờ tất cả các file được upload xong
                const s3Urls = await Promise.all(uploadPromises);
                // console.log('--- DEBUG: URLs generated in middleware ---', s3Urls);

                // Gắn kết quả vào request CHO BƯỚC TIẾP THEO.
                req.s3FileUrls = s3Urls;
            }

            // Xử lý một file (nếu có)
            if (req.file) {
                const s3Url = await uploadFileToS3(req.file.buffer, req.file.originalname, req.file.mimetype, destinationFolder);
                req.s3FileUrl = s3Url;
            }

            // Gọi next() để tiếp tục xử lý request
            next();
        } catch (error) {
            console.error('S3 Upload Middleware Error:', error);
            res.status(500).json({ success: false, message: 'S3 Upload Middleware Error.' });
        }
    };
};

module.exports = {
    handleMulter,
    processAndUploadToS3,
};
