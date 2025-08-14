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

exports.getTopCategoriesReport = async (req, res) => {
    try {
        // 1. Controller nhận và xử lý tham số từ request
        const limit = parseInt(req.query.limit) || 10;

        // 2. Gọi hàm service tương ứng để lấy dữ liệu
        const topCategories = await categoryService.getTopCategoriesByBookings(limit);

        // 3. Trả về response thành công với dữ liệu nhận được
        res.status(200).json({
            success: true,
            message: `Lấy ${limit} danh mục hàng đầu thành công.`,
            data: topCategories
        });

    } catch (error) {
        // 4. Xử lý và trả về response lỗi nếu có
        res.status(500).json({
            success: false,
            message: error.message || "Đã có lỗi xảy ra ở server."
        });
    }
};