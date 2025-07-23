const technicianService = require('./technicianService');

const deductCommission = async (technicianId, amount, session) => {
    try {
        const technician = await technicianService.getTechnicianById(technicianId);
        if (!technician) {
            throw new Error('Technician not found for commission deduction.');
        }

        // Using a fixed 30% commission rate as per the example.
        // This could be made dynamic later by fetching from CommissionConfig.
        const commissionRate = 0.30;
        const commissionAmount = amount * commissionRate;

        technician.balance -= commissionAmount;
        technician.totalEarning += amount*0.70
        technician.totalCommissionPaid += amount*0.1
        technician.totalHoldingAmount += amount*0.20
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
        const commissionRate = 0.70;
        const commissionAmount = amount * commissionRate;

        technician.balance += commissionAmount;
        technician.totalEarning += commissionAmount
        technician.totalCommissionPaid += amount*0.1
        technician.totalHoldingAmount += amount*0.20
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

module.exports = {
    deductCommission,
    creditCommission
};
