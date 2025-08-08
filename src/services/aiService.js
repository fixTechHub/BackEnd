const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('redis');
const { CohereClient } = require("cohere-ai");
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const cosineSimilarity = require('cosine-similarity');

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.API_AI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Initialize Cohere
const cohere = new CohereClient({
    token: process.env.COHERE_DUY_API_KEY,
});

// Redis client setup
const redisClient = createClient({
    url: process.env.REDIS_URL
});

// Handle Redis connection
redisClient.on('connect', () => {
    console.log('Redis client connected');
});

redisClient.on('error', (err) => {
    console.error('Redis client error:', err);
});

// Connect to Redis
(async () => {
    try {
        await redisClient.connect();
    } catch (error) {
        console.error('Failed to connect to Redis:', error);
    }
})();

const knownDevices = [
    "máy giặt",'máy lạnh','tủ đông','tủ mát','bàn là','', "tủ lạnh", "điều hòa", "quạt", "quạt điện", "lò vi sóng",
    "máy xay sinh tố", "tivi", "bếp điện", "nồi cơm", "bàn ủi", "máy nước nóng"
];

// Session expires after 20 minutes (in seconds for Redis)
const SESSION_TIMEOUT = 20 * 60; // 1200 seconds

function extractDeviceName(message) {
    const lowercase = message.toLowerCase();
    for (let device of knownDevices) {
        if (lowercase.includes(device)) {
            return device;
        }
    }
    return null;
}

function getSessionKey(userId) {
    return `session:${userId}`;
}

async function updateSession(userId, device, userMessage, botResponse = null) {
    const sessionKey = getSessionKey(userId);

    try {
        let session;
        const existingSession = await redisClient.get(sessionKey);

        if (existingSession) {
            session = JSON.parse(existingSession);
        } else {
            session = {
                lastDevice: null,
                conversation: [],
                createdAt: Date.now()
            };
        }

        if (device) {
            session.lastDevice = device;
        }

        session.conversation.push({
            user: userMessage,
            bot: botResponse,
            timestamp: Date.now()
        });

        if (session.conversation.length > 6) {
            session.conversation = session.conversation.slice(-6);
        }

        session.lastActivity = Date.now();

        await redisClient.setEx(sessionKey, SESSION_TIMEOUT, JSON.stringify(session));

        return session;
    } catch (error) {
        console.error('Error updating session:', error);
        return {
            lastDevice: device,
            conversation: [],
            lastActivity: Date.now()
        };
    }
}

async function getSession(userId) {
    const sessionKey = getSessionKey(userId);

    try {
        const sessionData = await redisClient.get(sessionKey);

        if (!sessionData) {
            return null;
        }

        return JSON.parse(sessionData);
    } catch (error) {
        console.error('Error getting session:', error);
        return null;
    }
}

async function getSessionStats() {
    try {
        const keys = await redisClient.keys('session:*');
        const activeSessions = keys.length;

        return {
            activeSessions,
            redisConnected: redisClient.isReady
        };
    } catch (error) {
        console.error('Error getting session stats:', error);
        return { activeSessions: 0, redisConnected: false };
    }
}

async function getCohereEmbedding(text) {
    try {
        const embedResponse = await cohere.embed({
            texts: [text],
            model: 'embed-multilingual-v3.0',
            input_type: 'search_query'
        });
        return embedResponse.embeddings[0];
    } catch (error) {
        console.error('Error generating Cohere embedding:', error);
        throw error;
    }
}

async function suggestServices(description) {
    try {
        const inputEmbedding = await getCohereEmbedding(description);
        const services = await Service.find({ isActive: true }).lean();
        const scored = services.map(s => {
            if (!s.embedding || !Array.isArray(s.embedding) || s.embedding.length === 0) {
                console.log(`Skipping service "${s.serviceName}" due to invalid or empty embedding.`);
                return { ...s, score: -1 };
            }
            const score = cosineSimilarity(inputEmbedding, s.embedding);
            return { ...s, score };
        });
        // Filter services with score > 0.3 and sort by score
        let result = scored.filter(s => s.score > 0.3).sort((a, b) => b.score - a.score);
        // Remove embedding field from results
        result = result.map(({ embedding, ...rest }) => rest);
        if (result.length === 0) {
            // Fallback: keyword-based search
            const regex = new RegExp(description, 'i');
            result = await Service.find({
                $or: [
                    { serviceName: regex },
                    { description: regex }
                ],
                isActive: true
            }).lean();
            // Remove embedding field
            result = result.map(({ embedding, ...rest }) => rest);
        }
        return result;
    } catch (err) {
        console.error('Error in suggestServices:', err);
        // Fallback: keyword-based search
        const regex = new RegExp(description, 'i');
        let result = await Service.find({
            $or: [
                { serviceName: regex },
                { description: regex }
            ],
            isActive: true
        }).lean();
        // Remove embedding field
        result = result.map(({ embedding, ...rest }) => rest);
        return result;
    }
}

function parseUserMessage(userMessage, session) {
    const currentDevice = extractDeviceName(userMessage);

    if (currentDevice) {
        return userMessage;
    }

    const hasPronouns = /(nó|thiết bị này|cái đó|thiết bị đó|cái này)/i.test(userMessage);
    if (!hasPronouns) {
        return userMessage;
    }

    const lastDevice = session?.lastDevice;

    if (lastDevice) {
        return userMessage.replace(/(nó|thiết bị này|cái đó|thiết bị đó|cái này)/gi, lastDevice);
    }

    return userMessage;
}

const aiChatBot = async (userMessage, userId, token) => {
    try {
        let session = await getSession(userId);
        const currentDevice = extractDeviceName(userMessage);
        const isTechnicianRequest = /(giới thiệu kỹ thuật viên|đề xuất kỹ thuật viên|tìm kỹ thuật viên|liên hệ kỹ thuật viên|kỹ thuật viên nào|kỹ thuật viên|thợ)/i.test(userMessage);
        console.log('Technician Request:', isTechnicianRequest);

        if (isTechnicianRequest) {
            // If no device is mentioned, use the lastDevice from session
            const deviceToUse = currentDevice || (session?.lastDevice);
            if (!deviceToUse) {
                const responseText = "Xin lỗi, tôi không biết bạn đang muốn sửa thiết bị nào. Vui lòng cung cấp thông tin về thiết bị hoặc vấn đề bạn gặp phải.";
                await updateSession(userId, currentDevice, userMessage, responseText);
                return responseText;
            }

            // Use suggestServices to find matching services
            const textToMatch = deviceToUse ? `Sửa chữa ${deviceToUse}` : userMessage;
            const matchedServices = await suggestServices(textToMatch);

            if (!matchedServices || matchedServices.length === 0) {
                const responseText = `Xin lỗi, tôi không thể tìm thấy dịch vụ phù hợp cho ${deviceToUse || 'yêu cầu của bạn'}. Vui lòng cung cấp thêm thông tin về thiết bị hoặc vấn đề bạn gặp phải.`;
                await updateSession(userId, currentDevice, userMessage, responseText);
                return responseText;
            }

            // Select the service with the highest similarity score (if using embeddings) or the first match
            const bestMatch = matchedServices[0].score !== undefined
                ? matchedServices.sort((a, b) => (b.score || 0) - (a.score || 0))[0]
                : matchedServices[0];

            console.log(`Selected service: ${bestMatch.serviceName}${bestMatch.score !== undefined ? ` with similarity ${bestMatch.score}` : ''}`);

            // Prepare data for the create-new-booking-request endpoint
            const bookingData = {
                serviceId: bestMatch._id.toString(),
                description: userMessage,
                address: 'Đà Nẵng, Việt Nam',
                type: 'urgent'
            };

            // Make HTTP POST request to create-new-booking-request endpoint
            const apiBaseUrl = process.env.BACK_END_URL || 'http://localhost:3000';
            try {
                const response = await axios.post(
                    `${apiBaseUrl}/bookings/create-new-booking-request`,
                    bookingData,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `token=${token}`
                        },
                        withCredentials: true
                    }
                );

                const { success, message, booking } = response.data;

                if (!success) {
                    console.error('Booking creation failed:', message);
                    const responseText = "Xin lỗi, không thể tạo yêu cầu đặt lịch lúc này. Vui lòng thử lại sau.";
                    await updateSession(userId, currentDevice, userMessage, responseText);
                    return responseText;
                }

                const frontendUrl = process.env.FRONT_END_URL || 'https://yourwebsite.com';
                const chooseTechnicianUrl = `${frontendUrl}/booking/choose-technician?bookingId=${booking._id}`;

                const responseText = `Tôi đã tạo một yêu cầu đặt lịch cho dịch vụ "${bestMatch.serviceName}". Bạn có thể chọn kỹ thuật viên phù hợp tại đây: ${chooseTechnicianUrl}`;

                await updateSession(userId, currentDevice || deviceToUse, userMessage, responseText);
                return responseText;
            } catch (apiError) {
                console.error('Error calling create-new-booking-request:', apiError.response?.data || apiError.message);
                const responseText = "Xin lỗi, có lỗi khi tạo yêu cầu đặt lịch. Vui lòng thử lại sau.";
                await updateSession(userId, currentDevice || deviceToUse, userMessage, responseText);
                return responseText;
            }
        }

        // Handle troubleshooting for device issues
        const processedMessage = parseUserMessage(userMessage, session);

        let conversationContext = '';
        if (session && session.conversation.length > 0) {
            const recentExchanges = session.conversation.slice(-3);
            conversationContext = recentExchanges
                .map(exchange => `Khách hàng: ${exchange.user}\nKỹ thuật viên: ${exchange.bot}`)
                .join('\n\n');
            conversationContext = `\nNGỮ CẢNH CUỘC TRÒ CHUYỆN TRƯỚC ĐÓ:\n${conversationContext}\n`;
        }

        const prompt = `
Bạn là một kỹ thuật viên điện dân dụng có kinh nghiệm tại Việt Nam.

Nhiệm vụ của bạn là hỗ trợ khách hàng kiểm tra và khắc phục sự cố với **các thiết bị điện và điện tử trong gia đình**, 
bao gồm các thiết bị nhà bếp, thiết bị giải trí, thiết bị làm mát/làm nóng, thiết bị chiếu sáng, thiết bị điện cầm tay, và các hệ thống điện dân dụng khác.
${conversationContext}
Yêu cầu:
- Hướng dẫn khách hàng bằng tiếng Việt đơn giản, dễ hiểu.
- Nếu khách hàng sử dụng "nó", "cái này", "thiết bị này" mà không rõ ngữ cảnh, hãy hỏi cụ thể về thiết bị nào.
- Cung cấp các bước kiểm tra và xử lý sự cố theo trình tự logic.
- Cảnh báo an toàn nếu có nguy cơ chập điện, rò điện, cháy nổ.
- Chỉ gợi ý liên hệ kỹ thuật viên hoặc sử dụng đường link đặt lịch khi khách hàng yêu cầu rõ ràng (ví dụ: sử dụng từ "kỹ thuật viên" hoặc "thợ"). Nếu có yêu cầu đặt lịch trước đó trong ngữ cảnh, bạn có thể nhắc lại rằng họ có thể yêu cầu kỹ thuật viên nếu cần, nhưng không tự động cung cấp đường link đặt lịch.
- Luôn lịch sự, thân thiện và chuyên nghiệp.

Câu hỏi hiện tại của khách hàng:
"${processedMessage}"

Hãy trả lời như một kỹ thuật viên thực thụ: rõ ràng, tuần tự và dễ làm theo.
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text();

        await updateSession(userId, currentDevice, userMessage, responseText);

        return responseText;
    } catch (error) {
        console.error("Lỗi khi gọi mô hình Gemini hoặc xử lý yêu cầu:", error);
        return "Xin lỗi, hiện tại tôi không thể xử lý yêu cầu của bạn. Vui lòng thử lại sau.";
    }
};

process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    try {
        await redisClient.quit();
        console.log('Redis connection closed');
    } catch (error) {
        console.error('Error closing Redis connection:', error);
    }
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
});

module.exports = {
    aiChatBot,
    getSessionStats,
    getSession,
    updateSession,
    suggestServices
};