const technicianSubscriptionService = require('../services/technicianSubscriptionService');
// const HttpError = require('../utils/error');

// 📌 Lấy các gói có thể đăng ký
exports.getAvailablePackages = async (req, res) => {
    try {
        const packages = await technicianSubscriptionService.getAvailablePackages();
        res.status(200).json({
            message: 'Lấy danh sách gói khả dụng thành công',
            data: packages
        });
    } catch (error) {
        console.error('Error getting available packages:', error);
        res.status(500).json({
            message: 'Lỗi server khi lấy gói khả dụng',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// 📌 Đăng ký gói mới
exports.subscribePackage = async (req, res) => {
    try {
        const { technicianId, packageId, paymentMethod } = req.body;
        const subscription = await technicianSubscriptionService.subscribePackage(
            technicianId, packageId, paymentMethod
        );

        res.status(201).json({
            message: 'Đăng ký gói thành công',
            data: subscription
        });
    } catch (error) {
        console.error('Error subscribing package:', error);
        res.status(500).json({
            message: 'Lỗi server khi đăng ký gói',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};


// 📌 Gia hạn gói
exports.renewSubscription = async (req, res) => {
    try {
        const technicianId = req.user.id;

        const subscription = await technicianSubscriptionService.renewSubscription(technicianId);

        res.status(200).json({
            message: 'Gia hạn gói thành công',
            data: subscription
        });
    } catch (error) {
        console.error('Error renewing subscription:', error);
        res.status(error.statusCode || 500).json({
            message: error.message || 'Lỗi server khi gia hạn gói'
        });
    }
};

// 📌 Lấy gói hiện tại của technician
exports.getCurrentSubscription = async (req, res) => {
    try {
        const technicianId = req.params.technicianId;

        const subscription = await technicianSubscriptionService.getCurrentSubscription(technicianId);

        res.status(200).json({
            message: 'Lấy gói hiện tại thành công',
            data: subscription
        });
    } catch (error) {
        console.error('Error getting current subscription:', error);
        res.status(error.statusCode || 500).json({
            message: error.message || 'Lỗi server khi lấy gói hiện tại'
        });
    }
};
