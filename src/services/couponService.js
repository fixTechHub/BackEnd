const Coupon = require('../models/Coupon');
const CouponUsage = require('../models/CouponUsage');
const mongoose = require('mongoose');

const getUserCoupon = async (userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const now = new Date();

    // Find all coupons that are valid for the user
    const allCoupons = await Coupon.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: [
        { audience: 'ALL' },
        {
          audience: 'SPECIFIC_USERS',
          userIds: { $in: [userObjectId] }
        }
      ]
    }).session(session);

    // Find all coupon usages by this user
    const usedCouponUsages = await CouponUsage.find({ userId: userObjectId }).session(session);
    const usedCouponIds = usedCouponUsages.map(usage => usage.couponId.toString());

    // Filter out coupons that have been used
    const userCoupons = allCoupons.filter(coupon => !usedCouponIds.includes(coupon._id.toString()));

    await session.commitTransaction();
    session.endSession();
    
    return userCoupons;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const getCouponByCouponCode = async (couponCode) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const coupon = await Coupon.findOne({ code: couponCode }).session(session);
        if (!coupon) {
            throw new Error('Không tìm thấy mã giảm giá');
        }
        return coupon
    } catch (error) {
        throw error;
    }
}

module.exports = {
  getUserCoupon,
  getCouponByCouponCode
};
