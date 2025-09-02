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
    console.log("🚀 subscribePackage called with:", { technicianId, packageId, paymentMethod });
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
        // await technician.save();
    }

    console.log('selectedPackage:', selectedPackage);
    console.log('selectedPackage.type:', selectedPackage.type);
    technician.isSubscribe = true;
    technician.subscriptionStatus = selectedPackage.type;
    await technician.save();

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

// ✅ Helper: cập nhật nếu đã có ACTIVE, còn không thì tạo mới (UP SERT)
const upsertActiveSubscription = async ({
  technicianId,
  packageId,
  amount,                 // số tiền đã thanh toán
  method = 'BANK',        // 'BANK' | 'BALANCE' ...
  durationDays = 30,      // số ngày hiệu lực
  session,
}) => {
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

  // ⚠️ Chú ý: dùng findOneAndUpdate + upsert:true
  // - Nếu tồn tại ACTIVE => cập nhật
  // - Nếu chưa tồn tại => chèn mới với technician + status lấy từ filter
  const sub = await TechnicianSubscription.findOneAndUpdate(
    { technician: technicianId, status: 'ACTIVE' },   // filter
    {
      $set: {
        package: packageId,
        startDate,
        endDate,
        status: 'ACTIVE',
      },
      $push: {
        paymentHistory: {
          amount: Number(amount) || 0,
          paidAt: new Date(),
          method,
        },
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      session,
    }
  );

  return sub;
};

const expireOverdueSubscriptions = async () => {
  const now = new Date();

  // Lấy danh sách sub đã quá hạn nhưng chưa EXPIRED
  const overdue = await TechnicianSubscription.find(
    { status: { $ne: 'EXPIRED' }, endDate: { $lte: now } },
    { _id: 1, technician: 1 }
  ).lean();

  if (!overdue.length) {
    return { updatedSubs: 0, updatedTechs: 0, techIds: [] };
  }

  const subIds = overdue.map(s => s._id);
  const techIds = [...new Set(overdue.map(s => String(s.technician)))];

  const [subRes, techRes] = await Promise.all([
    TechnicianSubscription.updateMany(
      { _id: { $in: subIds } },
      { $set: { status: 'EXPIRED' } }
    ),
    Technician.updateMany(
      { _id: { $in: techIds } },
      { $set: { isSubscribe: false, subscriptionStatus: 'FREE' } }
    ),
  ]);

  const updatedSubs  = subRes.modifiedCount  ?? subRes.nModified  ?? 0;
  const updatedTechs = techRes.modifiedCount ?? techRes.nModified ?? 0;

  return { updatedSubs, updatedTechs, techIds };
};


module.exports = {
    getAvailablePackages,
    subscribePackage,
    renewSubscription,
    getCurrentSubscription,
    upsertActiveSubscription,
    expireOverdueSubscriptions
};
