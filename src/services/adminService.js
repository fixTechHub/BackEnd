const mongoose = require('mongoose');
const Technician = require('../models/Technician');
const contractService = require('./contractService');
const notificationService = require('./notificationService');
const HttpError = require('../utils/error');

exports.approveTechnician = async (technicianId) => {
    // Start a new session for the transaction
    const session = await mongoose.startSession();
    
    try {
        // Start the transaction
        await session.startTransaction();

        const technician = await Technician.findById(technicianId).session(session);
        if (!technician) {
            throw new HttpError(404, 'Technician not found');
        }

        if (technician.status === 'APPROVED') {
            throw new HttpError(400, 'Technician has already been approved');
        }

        technician.status = 'APPROVED';
        await technician.save({ session });

        // After approval, automatically generate the contract and the notification
        const { notification } = await contractService.generateContractOnRegistration(technician._id, session);

        // Commit the transaction
        await session.commitTransaction();
        
        // After the transaction is successfully committed, send the notification
        notificationService.sendSocketNotification(notification);

        return technician;
        
    } catch (error) {
        // Rollback the transaction in case of error
        await session.abortTransaction();
        throw error;
    } finally {
        // End the session
        await session.endSession();
    }
};