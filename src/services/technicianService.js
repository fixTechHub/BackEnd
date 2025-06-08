const Technician = require('../models/Technician')

exports.createNewTechnician = async (userId, technicianData) => {
    const technician = new Technician({
        userId,
        identification: technicianData.identification,
        specialties: technicianData.specialties || '',
        certificate: technicianData.certificate || [],
        certificateVerificationStatus: false,
        jobCompleted: 0,
        availability: 'FREE',
        contractAccepted: false,
        balance: 0,
        isAvailableForAssignment: false,
    });
    
    return await technician.save();
};
exports.findTechnicianByUserId = async (userId) => {
    return await Technician.findOne({userId})
}