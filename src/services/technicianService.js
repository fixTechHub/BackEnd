const Technician = require('../models/Technician')

exports.createNewTechnician = async (userId) => {
    const technician = new Technician({
        userId
    })
    return await technician.save();

}
exports.findTechnicianByUserId = async (userId) => {
    return await Technician.findOne({userId})
}