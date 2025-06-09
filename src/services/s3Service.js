require('dotenv').config();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;
const REGION = process.env.AWS_REGION;
const ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

// Khởi tạo S3 client với thông tin xác thực
const s3Client = new S3Client({
    region: REGION,
    credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
    },
});

/**
 * Hàm tải một file lên S3 bucket vào một thư mục cụ thể
 * @param {Buffer} fileBuffer
 * @param {string} originalName
 * @param {string} mimetype
 * @param {string} folder - Thư mục trên S3 (e.g., 'avatars', 'bookings')
 * @returns {Promise<string>} - URL của file trên S3
 */
const uploadFileToS3 = async (fileBuffer, originalName, mimetype, folder = 'others') => {
    const uniqueFileName = `${Date.now()}_${originalName.replace(/\s/g, '_')}`;
    const key = `${folder}/${uniqueFileName}`; // <-- TỔ CHỨC FILE VÀO THƯ MỤC

    const params = {
        Bucket: BUCKET_NAME,
        Key: key, // <-- SỬ DỤNG KEY MỚI
        Body: fileBuffer,
        ContentType: mimetype,
    };

    const command = new PutObjectCommand(params);

    try {
        await s3Client.send(command);
        const fileUrl = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${key}`;
        return fileUrl;
    } catch (error) {
        console.error("Error uploading to S3:", error);
        throw error;
    }
};

module.exports = { uploadFileToS3 };
