const cron = require('node-cron');
const contractService = require('../services/contractService');

// Schedule task to run every day at midnight
const scheduleExpiredContractCheck = () => {
    cron.schedule('0 0 * * *', async () => {
        try {
            console.log('Running expired contracts check...');
            const result = await contractService.updateExpiredContracts();
            console.log(`Updated ${result.modifiedCount} expired contracts`);
        } catch (error) {
            console.error('Error checking expired contracts:', error);
        }
    });
};

module.exports = {
    scheduleExpiredContractCheck
}; 