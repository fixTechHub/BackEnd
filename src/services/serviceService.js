const Service = require("../models/Service");

exports.getPublicServices = async () => {
    return await Service.find({ isActive: true }).sort({ createdAt: -1 });
};

exports.getPublicServicesByCategoryId = async (id) => {
    return await Service.find({ categoryId: id });
};