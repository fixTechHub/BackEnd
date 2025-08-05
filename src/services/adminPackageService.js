const CommissionPackage = require('../models/CommissionPackage');
// const HttpError = require('../utils/error'); // nếu bạn có custom error

// 📌 Tạo gói
const createPackage = async (data) => {
    const pkg = new CommissionPackage(data);
    return await pkg.save();
};

// 📌 Cập nhật gói
const updatePackage = async (id, data) => {
    const pkg = await CommissionPackage.findByIdAndUpdate(id, data, { new: true });
    if (!pkg) throw new HttpError(404, 'Package not found');
    return pkg;
};

// 📌 Xóa gói
const deletePackage = async (id) => {
    const pkg = await CommissionPackage.findByIdAndDelete(id);
    if (!pkg) throw new HttpError(404, 'Package not found');
    return pkg;
};

// 📌 Bật/tắt gói
const togglePackage = async (id) => {
    const pkg = await CommissionPackage.findById(id);
    if (!pkg) throw new HttpError(404, 'Package not found');

    pkg.isActive = !pkg.isActive;
    await pkg.save();
    return pkg;
};

// 📌 Lấy tất cả gói
const getAllPackages = async () => {
    return await CommissionPackage.find();
};

module.exports = {
    createPackage,
    updatePackage,
    deletePackage,
    togglePackage,
    getAllPackages
};
