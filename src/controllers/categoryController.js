const categoryService = require('../services/categoryService');

exports.getPublicCategories = async (req, res) => {
    try {
        const categories = await categoryService.getPublicCategories();

        res.status(200).json({
            message: 'Lấy danh sách danh mục thành công',
            data: categories
        });
    } catch (error) {
        console.error('Error getting public categories:', error);
        res.status(500).json({
            message: 'Lỗi server khi lấy danh mục',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};