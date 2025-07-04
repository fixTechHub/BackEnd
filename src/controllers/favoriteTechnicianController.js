const favoriteTechnicianService = require('../services/favoriteTechnicianService');

// POST /favorites
exports.addFavoriteTechnician = async (req, res) => {
    try {
        const customerId = req.user.userId;
        const { technicianId } = req.body;

        if (!technicianId) {
            return res.status(400).json({ message: 'Thiếu technicianId' });
        }

        const favorite = await favoriteTechnicianService.addFavorite(customerId, technicianId);
        res.status(201).json({
            message: 'Thêm kỹ thuật viên vào yêu thích thành công',
            data: favorite
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// GET /favorites
exports.getFavoriteTechnicians = async (req, res) => {
    try {
        const customerId = req.user.userId;
        const favorites = await favoriteTechnicianService.getFavoritesByCustomer(customerId);
        res.status(200).json({
            message: 'Lấy danh sách yêu thích thành công',
            data: favorites
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// DELETE /favorites/:technicianId
exports.removeFavoriteTechnician = async (req, res) => {
    try {
        const customerId = req.user.userId;
        const { technicianId } = req.params;

        const result = await favoriteTechnicianService.removeFavorite(customerId, technicianId);
        res.status(200).json({
            message: 'Xóa kỹ thuật viên khỏi yêu thích thành công',
            data: result
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
}; 