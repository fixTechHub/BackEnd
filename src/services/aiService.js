// const { GoogleGenerativeAI } = require('@google/generative-ai');

// const genAI = new GoogleGenerativeAI(process.env.API_AI_KEY);
// const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
// const UserContext = require('../models/UserContext');

// const knownDevices = [
//     "máy giặt", "tủ lạnh", "điều hòa", "quạt", "quạt điện", "lò vi sóng",
//     "máy xay sinh tố", "tivi", "bếp điện", "nồi cơm", "bàn ủi", "máy nước nóng"
// ];

// function extractDeviceName(message) {
//     const lowercase = message.toLowerCase();
//     for (let device of knownDevices) {
//         if (lowercase.includes(device)) {
//             return device;
//         }
//     }
//     return null;
// }

// const parseUserMessage = async (userMessage, userId) => {
//     const device = extractDeviceName(userMessage);

//     let userContext = await UserContext.findOne({ userId });

//     if (!userContext) {
//         userContext = new UserContext({ userId });
//     }

//     if (device) {
//         userContext.lastDevice = device;
//         await userContext.save();
//     }

//     const lastDevice = userContext.lastDevice;

//     const resolvedMessage = lastDevice
//         ? userMessage.replace(/(nó|thiết bị này|cái đó|thiết bị đó)/gi, lastDevice)
//         : userMessage;

//     return resolvedMessage;
// };

// const aiChatBot = async (userMessage, userId) => {
//     const processedMessage = await parseUserMessage(userMessage, userId);

//     const prompt = `
// Bạn là một kỹ thuật viên điện dân dụng có kinh nghiệm tại Việt Nam.

// Nhiệm vụ của bạn là hỗ trợ người dùng kiểm tra và khắc phục sự cố với **các thiết bị điện và điện tử trong gia đình**, 
// bao gồm các thiết bị nhà bếp, thiết bị giải trí, thiết bị làm mát/làm nóng, thiết bị chiếu sáng, thiết bị điện cầm tay, và các hệ thống điện dân dụng khác.

// Yêu cầu:
// - Hướng dẫn người dùng bằng tiếng Việt đơn giản, dễ hiểu.
// - Nếu mô tả chưa rõ, hãy đặt thêm câu hỏi để làm rõ vấn đề.
// - Cung cấp các bước kiểm tra và xử lý sự cố theo trình tự.
// - Cảnh báo an toàn nếu có nguy cơ chập điện, rò điện, cháy nổ.
// - Gợi ý khi nào nên liên hệ thợ chuyên nghiệp nếu người dùng không thể tự xử lý.
// - Luôn lịch sự, thân thiện và chuyên nghiệp.

// Người dùng đang cần trợ giúp với vấn đề sau:
// "${processedMessage}"

// Hãy trả lời như một kỹ thuật viên thực thụ: rõ ràng, tuần tự và dễ làm theo.
// `;

//     try {
//         const result = await model.generateContent(prompt);
//         const response = await result.response;
//         return response.text();
//     } catch (error) {
//         console.error("Lỗi khi gọi mô hình Gemini:", error);
//         return "Xin lỗi, hiện tại tôi không thể xử lý yêu cầu của bạn.";
//     }
// };

// module.exports = {
//     aiChatBot
// };





const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('redis');

const genAI = new GoogleGenerativeAI(process.env.API_AI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
    "máy giặt", "tủ lạnh", "điều hòa", "quạt", "quạt điện", "lò vi sóng",
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
        // Get existing session or create new one
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

        // Update device context if new device mentioned
        if (device) {
            session.lastDevice = device;
        }

        // Add to conversation history (keep last 6 exchanges)
        session.conversation.push({
            user: userMessage,
            bot: botResponse,
            timestamp: Date.now()
        });

        if (session.conversation.length > 6) {
            session.conversation = session.conversation.slice(-6);
        }

        session.lastActivity = Date.now();

        // Save to Redis with automatic expiration
        await redisClient.setEx(sessionKey, SESSION_TIMEOUT, JSON.stringify(session));

        return session;
    } catch (error) {
        console.error('Error updating session:', error);
        // Fallback to basic session
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

// Optional: Get session statistics
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

const parseUserMessage = (userMessage, session) => {
    const currentDevice = extractDeviceName(userMessage);

    // If current message has device, return as is
    if (currentDevice) {
        return userMessage;
    }

    // Check if message contains pronouns
    const hasPronouns = /(nó|thiết bị này|cái đó|thiết bị đó|cái này)/i.test(userMessage);
    if (!hasPronouns) {
        return userMessage;
    }

    // Get device from session context
    const lastDevice = session?.lastDevice;

    if (lastDevice) {
        return userMessage.replace(/(nó|thiết bị này|cái đó|thiết bị đó|cái này)/gi, lastDevice);
    }

    return userMessage;
};

const aiChatBot = async (userMessage, userId) => {
    try {
        // Get current session from Redis
        let session = await getSession(userId);

        // Extract device from current message
        const currentDevice = extractDeviceName(userMessage);

        // Parse message with session context
        const processedMessage = parseUserMessage(userMessage, session);

        // Build conversation context for AI
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
- Gợi ý khi nào nên liên hệ thợ chuyên nghiệp.
- Luôn lịch sự, thân thiện và chuyên nghiệp.

Câu hỏi hiện tại của khách hàng:
"${processedMessage}"

Hãy trả lời như một kỹ thuật viên thực thụ: rõ ràng, tuần tự và dễ làm theo.
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text();

        // Update session with current exchange in Redis
        await updateSession(userId, currentDevice, userMessage, responseText);

        return responseText;
    } catch (error) {
        console.error("Lỗi khi gọi mô hình Gemini:", error);
        return "Xin lỗi, hiện tại tôi không thể xử lý yêu cầu của bạn. Vui lòng thử lại sau.";
    }
};

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    try {
        await redisClient.quit();
        console.log('Redis connection closed');
    } catch (error) {
        console.error('Error closing Redis connection:', error);
    }
    process.exit(0);
});

module.exports = {
    aiChatBot,
    getSessionStats,
    // Export for testing/debugging
    getSession,
    updateSession
};