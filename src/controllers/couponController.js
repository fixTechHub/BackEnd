const couponService = require('../services/couponService');

const getUserCoupons = async (req, res) => {
  try {
    const userId = req.user.userId;
    const coupons = await couponService.getUserCoupon(userId);
    res.status(200).json({ success: true, coupons });
  } catch (error) {
    console.error('Get User Coupons Error:', error);
    res.status(400).json({ success: false, message: error.message || 'Lỗi khi lấy mã giảm giá' });
  }
};

module.exports = {
  getUserCoupons,
};
