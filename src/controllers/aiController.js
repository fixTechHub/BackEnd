const { aiChatBot } = require('../services/aiService');

const getAiChatResponse = async (req, res) => {
    try {
        const { message } = req.body;
        const userId = req.user.userId
        // const userId = '68477c06b6efa9a3615217dd'
        if (!message || message.trim() === "") {
            return res.status(400).json({ error: "Vui lòng nhập nội dung cần hỗ trợ." });
        }

        const response = await aiChatBot(message,userId);
        res.status(200).json({ reply: response });

    } catch (error) {
        console.error("Lỗi controller AI:", error);
        res.status(500).json({ error: "Đã xảy ra lỗi khi xử lý yêu cầu." });
    }
};

module.exports = {
    getAiChatResponse
};
