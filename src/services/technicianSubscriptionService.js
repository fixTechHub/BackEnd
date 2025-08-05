const TechnicianSubscription = require('../models/TechnicianSubscription');
const CommissionPackage = require('../models/CommissionPackage');
const Technician = require('../models/Technician');
const HttpError = require('../utils/error');

// 📌 Lấy gói đang mở bán cho technician
const getAvailablePackages = async () => {
    return await CommissionPackage.find({ isActive: true });
};

// 📌 Đăng ký gói
const subscribePackage = async (technicianId, packageId, paymentMethod = 'BALANCE') => {
    const selectedPackage = await CommissionPackage.findById(packageId);
    if (!selectedPackage || !selectedPackage.isActive) {
        throw new HttpError(400, 'Package not available');
    }

    // ✅ Kiểm tra nếu đã có gói active
    const existing = await TechnicianSubscription.findOne({ technician: technicianId, status: 'ACTIVE' });
    if (existing) {
        throw new HttpError(400, 'Technician already has an active package');
    }

    // ✅ Lấy thông tin technician
    const technician = await Technician.findById(technicianId);
    if (!technician) throw new HttpError(404, 'Technician not found');

    // ✅ Nếu thanh toán bằng BALANCE thì trừ tiền
    if (paymentMethod === 'BALANCE') {
        if (technician.balance < selectedPackage.price) {
            throw new HttpError(400, 'Insufficient balance to purchase this package');
        }
        technician.balance -= selectedPackage.price;
        await technician.save();
    }

    // ✅ Tạo subscription
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    const subscription = new TechnicianSubscription({
        technician: technicianId,
        package: packageId,
        startDate,
        endDate,
        status: 'ACTIVE',
        paymentHistory: [{
            amount: selectedPackage.price,
            paidAt: new Date(),
            method: paymentMethod   // ✅ Lưu BALANCE hoặc BANK_TRANSFER
        }]
    });

    return await subscription.save();
};


const renewSubscription = async (technicianId, paymentMethod = 'BALANCE') => {
    const subscription = await TechnicianSubscription
        .findOne({ technician: technicianId, status: 'ACTIVE' })
        .populate('package');

    if (!subscription) throw new HttpError(404, 'No active subscription found');

    // ✅ Lấy thông tin technician
    const technician = await Technician.findById(technicianId);
    if (!technician) throw new HttpError(404, 'Technician not found');

    // ✅ Nếu thanh toán bằng BALANCE thì trừ tiền
    if (paymentMethod === 'BALANCE') {
        if (technician.balance < subscription.package.price) {
            throw new HttpError(400, 'Insufficient balance to renew this package');
        }
        technician.balance -= subscription.package.price;
        await technician.save();
    }

    // ✅ Gia hạn gói
    subscription.endDate.setMonth(subscription.endDate.getMonth() + 1);
    subscription.paymentHistory.push({
        amount: subscription.package.price,
        paidAt: new Date(),
        method: paymentMethod
    });

    return await subscription.save();
};


// 📌 Lấy gói hiện tại
const getCurrentSubscription = async (technicianId) => {
    return await TechnicianSubscription.findOne({ technician: technicianId, status: 'ACTIVE' }).populate('package');
};

module.exports = {
    getAvailablePackages,
    subscribePackage,
    renewSubscription,
    getCurrentSubscription
};
