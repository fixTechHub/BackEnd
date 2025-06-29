const cron = require('node-cron');
const mongoose = require('mongoose');
const BookingWarranty = require('../models/BookingWarranty');
const BookingPrice = require('../models/BookingPrice');
const Technician = require('../models/Technician');
const notificationService = require('../services/notificationService');

class BookingWarrantyCronService {
    constructor() {
        this.isRunning = false;
    }

    // Start all cron jobs
    startCronJobs() {
        console.log('Starting booking warranty expiration cron jobs...');

        // Run every day at 8:00 AM to check for expired warranties
        cron.schedule('0 8 * * *', () => {
            this.checkExpiredWarranties();
        });

        console.log('Booking warranty expiration cron jobs started successfully');
    }

    // Check and process expired warranties
    async checkExpiredWarranties() {
        if (this.isRunning) {
            console.log('Warranty expiration check already running, skipping...');
            return;
        }

        this.isRunning = true;
        console.log('Starting expired warranties check...');

        try {
            const currentDate = new Date();

            // Find warranties that are expired but not yet processed
            const expiredWarranties = await BookingWarranty.find({
                expireAt: { $lt: currentDate },
                isUnderWarranty: true,
                status: { $in: ['PENDING', 'CONFIRMED', 'RESOLVED'] }
            }).populate('technicianId', 'customer','bookingId')

            console.log(`Found ${expiredWarranties.length} expired warranties to process`);

            for (const warranty of expiredWarranties) {
                try {
                    // Start a MongoDB session for transaction
                    const session = await mongoose.startSession();
                    await session.withTransaction(async () => {
                        // Update warranty status to DENIED or mark as processed
                        warranty.isUnderWarranty = false;
                        warranty.status = 'EXPIRED';
                        await warranty.save({ session });

                        // Find the associated BookingPrice
                        const bookingPrice = await BookingPrice.findOne({
                            bookingId: warranty.bookingId,
                            technicianId: warranty.technicianId
                        }).session(session);

                        if (!bookingPrice || !bookingPrice.finalPrice) {
                            console.warn(`No valid BookingPrice found for warranty ${warranty._id}`);
                            return;
                        }

                        // Calculate 20% of finalPrice
                        const refundAmount = bookingPrice.finalPrice * 0.2;


                        // Update technician's balance
                        const technician = await Technician.findById(warranty.technicianId._id).session(session);

                        if (!technician) {
                            throw new Error('Technician not found');
                        }

                        // Update balance and totalEarning manually
                        technician.balance = technician.balance + refundAmount;
                        technician.totalEarning = technician.totalEarning + refundAmount;

                        // Save the updated document with session
                        await technician.save({ session });
                        console.log(`Technician ${warranty.technicianId._id} balance updated with ${refundAmount}`);

                        // Send notification to technician
                        await this.sendWarrantyExpirationNotification(warranty, refundAmount, session);
                        console.log(`Warranty ${warranty._id} processed, technician notified`);
                    });
                    session.endSession();
                } catch (error) {
                    console.error(`Failed to process expired warranty ${warranty._id}:`, error.message);
                }
            }

            console.log('Expired warranties check completed');
        } catch (error) {
            console.error('Error in checkExpiredWarranties:', error.message);
        } finally {
            this.isRunning = false;
        }
    }

    // Send expiration notification to technician
    async sendWarrantyExpirationNotification(warranty, refundAmount, session) {
        const notificationDataTech = {
            userId: warranty.technicianId.userId, // Reference userId from Technician
            title: 'Hết hạn bảo hành',
            content: `Bảo hành cho đơn hàng ${warranty.bookingId.bookingCode} đã hết hạn. Số tiền ${refundAmount.toLocaleString()} đã được hoàn 20% vào số dư của bạn.`,
            referenceId: warranty._id,
            referenceModel: 'BookingWarranty',
            type: 'NEW_REQUEST'
        };
        const notificationDataCus = {
            userId: warranty.cus, // Reference userId from Technician
            title: 'Hết hạn bảo hành',
            content: `Bảo hành cho đơn hàng ${warranty.bookingId.bookingCode} đã hết hạn. Số tiền ${refundAmount.toLocaleString()} đã được hoàn 20% vào số dư của bạn.`,
            referenceId: warranty._id,
            referenceModel: 'BookingWarranty',
            type: 'NEW_REQUEST'
        };
        await notificationService.createAndSend(notificationDataTech, session);
    }

    // Manual trigger for testing purposes
    async runManualCheck() {
        console.log('Running manual warranty expiration check...');
        await this.checkExpiredWarranties();
        console.log('Manual warranty check completed');
    }

    // Stop all cron jobs (useful for graceful shutdown)
    stopCronJobs() {
        cron.destroy();
        console.log('Booking warranty expiration cron jobs stopped');
    }
}

// Export singleton instance
const bookingWarrantyCronService = new BookingWarrantyCronService();

module.exports = bookingWarrantyCronService;