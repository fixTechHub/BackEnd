const TechnicianService = require('../services/technicianService');

const registerAsTechnician = async (req, res, next) => {
  try {
    const technician = await TechnicianService.registerAsTechnician(req.body);
    res.status(201).json({
      message: 'Technician registration submitted. Waiting for admin approval.',
      technician,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {registerAsTechnician};
