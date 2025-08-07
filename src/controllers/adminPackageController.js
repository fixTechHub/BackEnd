const adminPackageService = require('../services/adminPackageService');

// 📌 Lấy danh sách gói
exports.getAllPackages = async (req, res) => {
    try {
        const packages = await adminPackageService.getAllPackages();
        res.status(200).json({
            message: 'Lấy danh sách gói thành công',
            data: packages
        });
    } catch (error) {
        console.error('Error getting packages:', error);
        res.status(500).json({
            message: 'Lỗi server khi lấy gói',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// 📌 Tạo gói mới
exports.createPackage = async (req, res) => {
    try {
        const pkg = await adminPackageService.createPackage(req.body);
        res.status(201).json({
            message: 'Tạo gói thành công',
            data: pkg
        });
    } catch (error) {
        console.error('Error creating package:', error);
        res.status(500).json({
            message: 'Lỗi server khi tạo gói',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// 📌 Cập nhật gói
// exports.updatePackage = async (req, res) => {
//     try {
//         const pkg = await adminPackageService.updatePackage(req.params.id, req.body);
//         res.status(200).json({
//             message: 'Cập nhật gói thành công',
//             data: pkg
//         });
//     } catch (error) {
//         console.error('Error updating package:', error);
//         res.status(500).json({
//             message: 'Lỗi server khi cập nhật gói',
//             error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
//         });
//     }
// };

exports.updatePackage = async (req, res) => {
    try {
        // Lấy _id từ body
        const { id } = req.params;  // ✅ lấy id từ param
        const updateData = req.body;

        const pkg = await adminPackageService.updatePackage(id, updateData);

        if (!pkg) {
            return res.status(404).json({
                message: 'Không tìm thấy gói để cập nhật'
            });
        }

        res.status(200).json({
            message: 'Cập nhật gói thành công',
            data: pkg
        });
    } catch (error) {
        console.error('Error updating package:', error);
        res.status(500).json({
            message: 'Lỗi server khi cập nhật gói',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};


// 📌 Xóa gói
exports.deletePackage = async (req, res) => {
    try {
        const pkg = await adminPackageService.deletePackage(req.params.id);
        res.status(200).json({
            message: 'Xóa gói thành công',
            data: pkg
        });
    } catch (error) {
        console.error('Error deleting package:', error);
        res.status(500).json({
            message: 'Lỗi server khi xóa gói',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// 📌 Bật/Tắt gói
exports.togglePackage = async (req, res) => {
    try {
        const pkg = await adminPackageService.togglePackage(req.params.id);
        res.status(200).json({
            message: 'Cập nhật trạng thái gói thành công',
            data: pkg
        });
    } catch (error) {
        console.error('Error toggling package:', error);
        res.status(500).json({
            message: 'Lỗi server khi bật/tắt gói',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};
