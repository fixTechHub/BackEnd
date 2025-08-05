const cron = require('node-cron');
const mongoose = require('mongoose');
const BookingWarranty = require('../models/BookingWarranty');
const Technician = require('../models/Technician');
const User = require('../models/User');
const Role = require('../models/Role');
const notificationService = require('../services/notificationService');
const Booking = require('../models/Booking')
class BookingWarrantyCronService {
    constructor() {
        this.isRunning = false;
        this.cronScheduled = false
        this.startCronJobs()
    }

    // Start all cron jobs
    startCronJobs() {
        if (this.cronScheduled) return;
        console.log('Starting booking warranty expiration cron jobs...');

        // Run every day at 8:00 AM to check for expired warranties
        cron.schedule('0 8 * * *', () => {
            this.checkExpiredBookings();
            this.checkExpireWarrantyRequest()
        });
        this.cronScheduled = true;
        console.log('Booking warranty expiration cron jobs started successfully');
    }

    // Check and process expired warranties
    async checkExpiredBookings() {
        if (this.isRunning) {
            console.log('Warranty expiration check already running, skipping...');
            return;
        }

        this.isRunning = true;
        console.log('Starting expired warranties check...');

        try {
            const currentDate = new Date();

            // Find warranties that are expired but not yet processed
            const bookings = await Booking.find({
                warrantyExpiresAt: { $lt: currentDate },
            }).populate('technicianId', 'customerId')

            console.log(`Found ${bookings.length} expired warranties to process`);
            
            for (const booking of bookings) {
                try {
                    // Start a MongoDB session for transaction
                    const session = await mongoose.startSession();
                    await session.withTransaction(async () => {
                        // Update warranty status to DENIED or mark as processed
                       

                        // Find the associated BookingPrice
                       

                        // Calculate 20% of finalPrice
                        const refundAmount = booking.finalPrice * 0.2;



                        if (!technician) {
                            throw new Error('Technician not found');
                        }

                        // Update balance and totalEarning manually
                        technician.balance = technician.balance + refundAmount;

                        // Save the updated document with session
                        await technician.save({ session });
                        console.log(`Technician ${booking.technicianId._id} balance updated with ${refundAmount}`);

                        // Send notification to technician
                        await this.sendWarrantyExpirationNotification(booking, refundAmount, session);
                        console.log(`Warranty ${booking._id} processed, technician notified`);
                    });
                    session.endSession();
                } catch (error) {
                    console.error(`Failed to process expired Booking ${booking._id}:`, error.message);
                }
            }

            console.log('Expired warranties check completed');
        } catch (error) {
            console.error('Error in checkExpiredWarranties:', error.message);
        } finally {
            this.isRunning = false;
        }
    }
    async checkExpireWarrantyRequest(){
        if (this.isRunning) {
            console.log('Warranty expiration check already running, skipping...');
            return;
        }

        this.isRunning = true;
        console.log('Starting expired warranties check...');
        try {
            const currentDate = new Date();

            // Find warranties that are expired and still PENDING
            const expiredWarranties = await BookingWarranty.find({
                expireAt: { $lt: currentDate },
                status: 'PENDING'
            }).populate([
                {
                    path: 'bookingId',
                    populate: { path: 'customerId' } // Populate customerId from Booking
                },
                {
                    path: 'technicianId',
                    populate: { path: 'userId', model: 'User' } // Populate userId from Technician
                }
            ]);
            const adminRole = await Role.findOne({ name: 'ADMIN' });
            if (!adminRole) {
                throw new Error('Admin role not found');
            }
            
            const admins = await User.find({ role: adminRole._id, status: 'ACTIVE' });
            for (const warranty of expiredWarranties) {
                const session = await mongoose.startSession();
                await session.withTransaction(async ()=> {
                    warranty.status = 'EXPIRED';
                    await warranty.save({ session });
                })
                const refundAmount = warranty.bookingId.finalPrice * 0.2;
                const technician = await Technician.findById(warranty.technicianId._id).session(session);
                technician.balance -= refundAmount
                technician.totalHoldingAmount -= refundAmount
                const techNotificationData = {
                    userId: technician._id,
                    title: 'Bảo hành hết hạn',
                    content: `Bạn đã không xử lý bảo hành đơn ${warranty.bookingId.bookingCode} nên sẽ bị xử phạt bằng việc trừ tiền trong tài khoản.`,
                    referenceId: warranty._id,
                    referenceModel: 'BookingWarranty',
                    type: 'NEW_REQUEST',
                    // url: 'warranty'
                };
                await notificationService.createAndSend(techNotificationData, session);

                await technician.save({ session });
                for (const admin of admins) {
                    const adminNotificationData = {
                        userId: admin._id,
                        title: 'Bảo hành hết hạn',
                        content: `Thợ ${warranty.technicianId.userId.fullName} đã không xử lý bảo hành đơn ${warranty.bookingId.bookingCode}.`,
                        referenceId: warranty._id,
                        referenceModel: 'BookingWarranty',
                        type: 'NEW_REQUEST',
                        // url: 'warranty'
                    };
                    await notificationService.createAndSend(adminNotificationData, session);
                    console.log(`Admin ${admin._id} notified of expired warranty ${warranty._id}`);
                }
            }
        } catch (error) {
            console.error('Error in checkExpiredWarranties:', error.message);
        } finally {
            this.isRunning = false;
        }
    }
    // Send expiration notification to technician
    async sendWarrantyExpirationNotification(booking, refundAmount, session) {
        const notificationDataTech = {
            userId: booking.technicianId.userId, // Reference userId from Technician
            title: 'Hết hạn bảo hành',
            content: `Bảo hành cho đơn hàng ${booking.bookingCode} đã hết hạn. Số tiền ${refundAmount.toLocaleString()} đã được hoàn 20% vào số dư của bạn.`,
            referenceId: booking._id,
            referenceModel: 'Booking',
            type: 'NEW_REQUEST'
        };
        const notificationDataCus = {
            userId: booking.customerId._id, // Reference userId from Technician
            title: 'Hết hạn bảo hành',
            content: `Bảo hành cho đơn hàng ${booking.bookingCode} đã hết hạn. Số tiền ${refundAmount.toLocaleString()} đã được hoàn 20% vào số dư của bạn.`,
            referenceId: booking._id,
            referenceModel: 'Booking',
            type: 'NEW_REQUEST'
        };
        await notificationService.createAndSend(notificationDataTech, session);
        await notificationService.createAndSend(notificationDataCus, session);

    }

    // Manual trigger for testing purposes
    async runManualCheck() {
        console.log('Running manual warranty expiration check...');
        await this.checkExpiredBookings();
        await this.checkExpireWarrantyRequest()
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
