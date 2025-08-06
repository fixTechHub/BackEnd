const serviceService = require('../services/serviceService');

exports.getPublicServices = async (req, res) => {
    try {
        const services = await serviceService.getPublicServices();

        res.status(200).json({
            message: 'Lấy danh sách dịch vụ thành công',
            data: services
        });
    } catch (error) {
        console.error('Error getting public services:', error);
        res.status(500).json({
            message: 'Lỗi server khi lấy dịch vụ',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

exports.getPublicServicesByCategoryId = async (req, res) => {
    try {
        const categoryId = req.params.id;

        const services = await serviceService.getPublicServicesByCategoryId(categoryId);

        res.status(200).json({
            message: 'Lấy danh sách dịch vụ theo danh mục thành công',
            data: services
        });
    } catch (error) {
        console.error('Error getting public services by categorId:', error);
        res.status(500).json({
            message: 'Lỗi server khi lấy dịch vụ',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
}

exports.suggestServices = async (req, res) => {
    try {
        const { descriptionSearch } = req.body;
        if (!descriptionSearch) {
            return res.status(400).json({
                message: 'Vui lòng cung cấp mô tả'
            });
        }
        const services = await serviceService.suggestServices(descriptionSearch);
        res.status(200).json({
            message: 'Gợi ý dịch vụ thành công',
            data: services
        });
    } catch (error) {
        console.error('Error suggesting services:', error);
        res.status(500).json({
            message: 'Lỗi server khi gợi ý dịch vụ',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};