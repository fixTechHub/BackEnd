const technicianService = require('./technicianService');

const deductCommission = async (technicianId, amount, session) => {
    try {
        const technician = await technicianService.getTechnicianById(technicianId);
        if (!technician) {
            throw new Error('Technician not found for commission deduction.');
        }

        // Using a fixed 15% commission rate as per the example.
        // This could be made dynamic later by fetching from CommissionConfig.
        const commissionRate = 0.15;
        const commissionAmount = amount * commissionRate;

        technician.balance -= commissionAmount;
        
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
    deductCommission
};
