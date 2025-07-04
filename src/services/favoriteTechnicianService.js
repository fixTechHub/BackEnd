const FavoriteTechnician = require('../models/FavoriteTechnician');

// Thêm kỹ thuật viên vào danh sách yêu thích
exports.addFavorite = async (customerId, technicianId) => {
    // Kiểm tra xem đã tồn tại
    const existing = await FavoriteTechnician.findOne({ customerId, technicianId });
    if (existing) {
        throw new Error('Kỹ thuật viên đã có trong danh sách yêu thích');
    }
    const favorite = new FavoriteTechnician({ customerId, technicianId });
    return await favorite.save();
};

// Xóa kỹ thuật viên khỏi danh sách yêu thích
exports.removeFavorite = async (customerId, technicianId) => {
    const deleted = await FavoriteTechnician.findOneAndDelete({ customerId, technicianId });
    if (!deleted) {
        throw new Error('Không tìm thấy mục yêu thích');
    }
    return deleted;
};

// Lấy danh sách kỹ thuật viên yêu thích của khách hàng
exports.getFavoritesByCustomer = async (customerId) => {
    return await FavoriteTechnician.find({ customerId })
        .populate({
            path: 'technicianId',
            populate: {
                path: 'userId',
                select: 'fullName email phone avatar'
            }
        })
        .sort({ createdAt: -1 });
}; 