const mongoose = require('mongoose');
const Technician = require('../models/Technician');
const contractService = require('./contractService');
const notificationService = require('./notificationService');
const HttpError = require('../utils/error');

exports.sendContractTechnician = async (technicianId) => {
    // Start a new session for the transaction
    const session = await mongoose.startSession();
    
    try {
        // Start the transaction
        await session.startTransaction();

        const technician = await Technician.findById(technicianId).session(session);
        if (!technician) {
            throw new HttpError(404, 'Technician not found');
        }

        // Get the latest contract for this technician
        const contracts = await contractService.getContractsByTechnicianId(technicianId);
        
        let shouldGenerateContract = true;
        let result = null;

        if (contracts && contracts.length > 0) {
            // Sort contracts by creation date (newest first) to get the latest one
            const latestContract = contracts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
            
            // Check the status of the latest contract
            if (latestContract.status === 'SIGNED' || latestContract.status === 'PENDING') {
                // Don't generate a new contract if the latest one is signed or pending
                shouldGenerateContract = false;
                console.log(`Contract already exists with status: ${latestContract.status}. Skipping contract generation.`);
            } else if (latestContract.status === 'EXPIRED' || latestContract.status === 'REJECTED') {
                // Generate a new contract if the latest one is expired or rejected
                shouldGenerateContract = true;
                console.log(`Latest contract status: ${latestContract.status}. Generating new contract.`);
            }
        }

        // Generate contract only if needed
        if (shouldGenerateContract) {
            // Note: Make sure contractService.generateContractOnRegistration supports sessions
            result = await contractService.generateContractOnRegistration(technicianId, session);
        }

        // Commit the transaction
        await session.commitTransaction();
        
        // After successful transaction commit, emit the notification only if a new contract was generated
        if (result && result.notificationData) {
            await notificationService.createAndSend(result.notificationData);
        }
        
        return {
            technician,
            contractGenerated: shouldGenerateContract,
            existingContractStatus: contracts && contracts.length > 0 
                ? contracts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].status 
                : null
        };
        
    } catch (error) {
        // Rollback the transaction in case of error
        await session.abortTransaction();
        throw error;
    } finally {
        // End the session
        await session.endSession();
    }
};