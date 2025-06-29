const cron = require('node-cron');
const mongoose = require('mongoose');
const Contract = require('../models/Contract');
const Technician = require('../models/Technician');
const notificationService = require('../services/notificationService');
const contractService = require('../services/contractService');

class ContractCronService {
    constructor() {
        this.isRunning = false;
    }

    // Start all cron jobs
    startCronJobs() {
        console.log('Starting contract expiration cron jobs...');

        // Run every day at 9:00 AM to check for expired contracts
        cron.schedule('0 9 * * *', () => {
            this.checkExpiredContracts();
        });

        // Run every day at 10:00 AM to check for contracts expiring in 7 days
        cron.schedule('0 10 * * *', () => {
            this.checkContractsExpiringIn7Days();
        });

        console.log('Contract expiration cron jobs started successfully');
    }

    // Check and update expired contracts
    async checkExpiredContracts() {
        if (this.isRunning) {
            console.log('Contract expiration check already running, skipping...');
            return;
        }

        this.isRunning = true;
        console.log('Starting expired contracts check...');

        try {
            const currentDate = new Date();

            // Find contracts that are expired but not marked as expired
            const expiredContracts = await Contract.find({
                expirationDate: { $lt: currentDate },
                status: { $in: ['PENDING', 'SIGNED'] }
            }).populate('technicianId', 'name email phone');

            console.log(`Found ${expiredContracts.length} expired contracts to update`);

            for (const contract of expiredContracts) {
                try {
                    // Update contract status to expired
                    await contractService.updateContractStatus(contract._id, 'EXPIRED');
                    if (contract.technicianId) {
                        await Technician.findByIdAndUpdate(
                            contract.technicianId._id,
                            { status: 'PENDING' },
                            { new: true }
                        );
                        console.log(`Technician ${contract.technicianId._id} status updated to PENDING`);

                        // Notify the technician about contract expiration
                        await this.sendExpirationNotification(contract);
                        console.log(`Contract ${contract.contractCode} marked as expired and technician notified`);
                    }
                } catch (error) {
                    console.error(`Failed to process expired contract ${contract._id}:`, error.message);
                }
            }

            console.log('Expired contracts check completed');
        } catch (error) {
            console.error('Error in checkExpiredContracts:', error.message);
        } finally {
            this.isRunning = false;
        }
    }

    // Check for contracts expiring in 7 days and send warning notifications
    async checkContractsExpiringIn7Days() {
        console.log('Starting 7-day expiration warning check...');

        try {
            const currentDate = new Date();
            const sevenDaysFromNow = new Date();
            sevenDaysFromNow.setDate(currentDate.getDate() + 7);

            // Find contracts expiring in 7 days that are still active
            const contractsExpiringIn7Days = await Contract.find({
                expirationDate: {
                    $gte: currentDate,
                    $lte: sevenDaysFromNow
                },
                status: { $in: ['PENDING', 'SIGNED'] }
            }).populate('technicianId', 'name email phone');

            console.log(`Found ${contractsExpiringIn7Days.length} contracts expiring in 7 days`);

            for (const contract of contractsExpiringIn7Days) {
                try {
                    if (contract.technicianId) {
                        await this.sendExpirationWarningNotification(contract);
                        console.log(`7-day warning sent for contract ${contract.contractCode}`);
                    }
                } catch (error) {
                    console.error(`Failed to send warning for contract ${contract._id}:`, error.message);
                }
            }

            console.log('7-day expiration warning check completed');
        } catch (error) {
            console.error('Error in checkContractsExpiringIn7Days:', error.message);
        }
    }

    // Send expiration notification to technician
    async sendExpirationNotification(contract) {
       
        const notificationData = {
            userId: contract.technicianId._id,
            
            title: 'Hạn hợp đồng',
            content: `Hợp đồng ${contract.contractCode} hết hạn vào ${contract.expirationDate.toDateString()}.`,
            referenceId: contract._id,
            referenceModel: 'Contract',
            type: 'NEW_REQUEST',
        };
        await notificationService.emitSocketNotification(notificationData);

        // You can also send email notification if you have email service
        // await emailService.sendContractExpirationEmail(contract.technicianId.email, contract);
    }

    // Send 7-day warning notification to technician
    async sendExpirationWarningNotification(contract) {
        const daysUntilExpiration = Math.ceil(
            (contract.expirationDate - new Date()) / (1000 * 60 * 60 * 24)
        );

        const notificationData = {
            userId: contract.technicianId._id,
            
            title: 'Hạn hợp đồng',
            content: `Hợp đồng ${contract.contractCode} sẽ hết hạn sau ${daysUntilExpiration} ngày.`,
            referenceId: contract._id,
            referenceModel: 'Contract',
            type: 'NEW_REQUEST',
        };

        await notificationService.emitSocketNotification(notificationData);

        // You can also send email notification if you have email service
        // await emailService.sendContractExpirationWarningEmail(contract.technicianId.email, contract, daysUntilExpiration);
    }

    // Manual trigger for testing purposes
    async runManualCheck() {
        console.log('Running manual contract expiration check...');
        await this.checkExpiredContracts();
        await this.checkContractsExpiringIn7Days();
        console.log('Manual check completed');
    }

    // Stop all cron jobs (useful for graceful shutdown)
    stopCronJobs() {
        cron.destroy();
        console.log('Contract expiration cron jobs stopped');
    }
}

// Export singleton instance
const contractCronService = new ContractCronService();

module.exports = contractCronService;










