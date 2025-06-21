const adminService = require('../services/adminService');

exports.approveTechnician = async (req, res) => {
    try {
        const { id } = req.params;
        const technician = await adminService.approveTechnician(id);
        res.status(200).json({
            message: 'Technician approved successfully',
            data: technician
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};
    