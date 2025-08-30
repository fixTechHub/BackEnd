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
        console.log('--- FILE ---', req.file);
        if (!req.file && !req.files) {
            return next();
        }

        try {
            console.log('--- S3 MIDDLEWARE ENTER ---');
            console.log('req.files?', Array.isArray(req.files), 'len:', req.files?.length);
            console.log('req.file?', !!req.file);

            // Xử lý nhiều file
            if (req.files && req.files.length > 0) {
                console.log('Uploading multiple files to S3...');
                const uploadPromises = req.files.map(file =>
                    
                    uploadFileToS3(file.buffer, file.originalname, file.mimetype, destinationFolder)
                );

                // Chờ tất cả các file được upload xong
                const s3Urls = await Promise.all(uploadPromises);
                 console.log('S3 URLs (multiple):', s3Urls);
                // console.log('--- DEBUG: URLs generated in middleware ---', s3Urls);

                // Gắn kết quả vào request CHO BƯỚC TIẾP THEO.
                console.log('Uploaded S3 URL:', s3Urls);
                req.s3FileUrls = s3Urls;
            }

            // Xử lý một file (nếu có)
            if (req.file) {
                  console.log('Uploading single file to S3...', req.file.originalname);
                const s3Url = await uploadFileToS3(req.file.buffer, req.file.originalname, req.file.mimetype, destinationFolder);
                 console.log('S3 URL (single):', s3Url);
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
