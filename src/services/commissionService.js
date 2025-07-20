const technicianService = require('./technicianService');
const CommissionConfig = require('../models/CommissionConfig');

const getAllCommissionConfigs = async () => {
    return await CommissionConfig.find().sort({ startDate: -1 }).lean();;
};

const getCurrentAppliedCommission = async () => {
    return await CommissionConfig.findOne({ isApplied: true }).sort({ startDate: -1 });
};

const deductCommission = async (technicianId, amount, session) => {
    try {
        const technician = await technicianService.getTechnicianById(technicianId);
        if (!technician) {
            throw new Error('Technician not found for commission deduction.');
        }

        // Using a fixed 10% commission rate as per the example.
        // This could be made dynamic later by fetching from CommissionConfig.
        const commissionRate = 0.30;
        const commissionAmount = amount * commissionRate;

        technician.balance -= commissionAmount;
        technician.totalEarning += amount*0.70

        // Use the provided session if it exists, otherwise save directly.
        if (session) {
            await technician.save({ session });
        } else {
            await technician.save();
        }

    } catch (error) {
        console.error('Error deducting commission:', error);
        throw error;
    }
};

const creditCommission = async (technicianId, amount, session) => {
    try {
        const technician = await technicianService.getTechnicianById(technicianId);
        if (!technician) {
            throw new Error('Technician not found for commission deduction.');
        }

        // Using a fixed 10% commission rate as per the example.
        // This could be made dynamic later by fetching from CommissionConfig.
        const commissionRate = 0.70;
        const commissionAmount = amount * commissionRate;

        technician.balance += commissionAmount;
        technician.totalEarning += commissionAmount

        // Use the provided session if it exists, otherwise save directly.
        if (session) {
            await technician.save({ session });
        } else {
            await technician.save();
        }

    } catch (error) {
        console.error('Error deducting commission:', error);
        throw error;
    }
};

const createCommissionConfig = async (data) => {
    const { commissionPercent, holdingPercent, commissionMinAmount, startDate } = data;

    // Đặt tất cả các config hiện tại về isApplied = false
    await CommissionConfig.updateMany({}, { isApplied: false });

    // Tạo config mới và đặt isApplied = true
    const newConfig = new CommissionConfig({
        commissionPercent,
        holdingPercent,
        commissionMinAmount,
        startDate,
        isApplied: true
    });

    return await newConfig.save();
};

module.exports = {
    getAllCommissionConfigs,
    getCurrentAppliedCommission,
    deductCommission,
    creditCommission,
    createCommissionConfig
};
