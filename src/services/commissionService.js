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

        // Using a fixed 20% commission rate as per the example.
        // This could be made dynamic later by fetching from CommissionConfig.
        const commissionRate = 0.20;
        const commissionAmount = amount * commissionRate;
        const earningAmount = amount - commissionAmount

        if (earningAmount > technician.balance) {
            // If balance is insufficient, add the difference to debBalance
            const shortfall = earningAmount - technician.balance;
            technician.debBalance += shortfall;
            technician.balance = 0; // Set balance to 0 since it's insufficient
        } else {
            // If balance is sufficient, deduct normally
            technician.balance -= earningAmount;
        }

        technician.totalEarning += amount
        technician.totalHoldingAmount += commissionAmount
        technician.jobCompleted += 1
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

        // Using a fixed 70% commission rate as per the example.
        // This could be made dynamic later by fetching from CommissionConfig.
        const commissionRate = 0.80;
        const earningAmount = amount * commissionRate;
        const commissionAmount =amount - amount * commissionRate;
 
        // Check if debBalance is greater than 0
        if (technician.debBalance > 0) {
            if (technician.debBalance >= earningAmount) {
                // If debBalance is sufficient, reduce it by earningAmount
                technician.debBalance -= earningAmount;
            } else {
                // If debBalance is less than earningAmount, reduce debBalance to 0
                // and add the remaining amount to balance
                const remainingAmount = earningAmount - technician.debBalance;
                technician.debBalance = 0;
                technician.balance += remainingAmount;
            }
        } else {
            // If no debBalance, add earningAmount directly to balance
            technician.balance += earningAmount;
        }
        technician.totalEarning += amount
        technician.totalHoldingAmount += commissionAmount
        technician.jobCompleted += 1
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
