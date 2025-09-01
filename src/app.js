require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const cookieParser = require("cookie-parser");
const routes = require('./routes')
const actionLogger = require('./middlewares/actionLogger');
const redisService = require('./services/redisService');

// Cấu hình trust proxy để giải quyết lỗi X-Forwarded-For
app.set('trust proxy', true);

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// Parse JSON
app.use(express.json());

app.use(
    cors({
        origin: [
            process.env.FRONT_END_URL, // http://localhost:5173
            process.env.FRONT_END_ADMIN_URL,
            'http://localhost:5173', // Explicitly include for safety
            'http://localhost:5174',
            // 'https://*.ngrok-free.app', // Wildcard not supported, use specific URLs
            'https://b8d9-2001-ee0-4b7b-3bd0-2d89-bdfa-7310-9e33.ngrok-free.app',
            'https://fix-tech-six.vercel.app',
            'https://fixtech.id.vn',
            'https://www.fixtech.id.vn',
            'https://fix-tech-git-bop-tris-projects-f8fdb778.vercel.app',
            'https://fix-tech-git-develop-tris-projects-f8fdb778.vercel.app',
            'https://fix-tech-git-duy-tris-projects-f8fdb778.vercel.app',
            'https://front-end-phi-two-10.vercel.app'
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        exposedHeaders: ['set-cookie']
    })
);

// app.use(actionLogger);

// Khởi tạo Redis service
const initializeRedis = async () => {
    try {
        await redisService.connect();
        console.log('Redis service đã được khởi tạo');
    } catch (error) {
        console.log('Không thể khởi tạo Redis, sử dụng fallback mode:', error.message);
    }
};

// Khởi tạo Redis khi app start
initializeRedis();

// app.options('*', cors());
// Routes (Định tuyến)
app.use('/api', routes);

module.exports = app;