const TechnicianService = require('../services/technicianService');



const viewTechnicianProfile = async (req, res) => {
  try {
    const { technicianId } = req.params;

    const technician = await Promise.all([
      TechnicianService.getTechnicianProfile(technicianId),
      TechnicianService.getCertificatesByTechnicianId(technicianId) // Sửa đúng
    ]);

    res.json({
      success: true,
      data: technician,
    });
  } catch (error) {
    console.error('Error fetching technician profile:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

const getCertificatesByTechnicianId = async (req, res) => {
  try {
    const { technicianId } = req.params;
    const certificates = await TechnicianService.getCertificatesByTechnicianId(technicianId);
    res.status(200).json({
      message: 'Certificates fetched successfully',
      certificates,
    });
  } catch (error) {
    console.error('Get certificates error:', error);
    res.status(error.status || 500).json({ message: error.message || 'Internal server error' });
  }
};


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


const viewJobDetails = async (req, res) => {
   try {
        const { technicianId, bookingId } = req.params;
        console.log("bookingId:", bookingId);
        console.log("technicianId:", technicianId);
        
        const booking = await TechnicianService.getJobDetails(bookingId, technicianId);

        res.status(200).json(booking);
    } catch (error) {
        console.error(error);
        if (error.status) {
            return res.status(error.status).json({ message: error.message });
        }

        res.status(500).json({ message: 'Server error' });
    }
}

  const viewEarningsByBooking = async (req, res) => {
  try {
    const technicianId = req.params;

    const earningList = await TechnicianService.getEarningsAndCommissionList(technicianId);

    res.json({
      success: true,
      data: earningList
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {registerAsTechnician, viewTechnicianProfile, getCertificatesByTechnicianId, viewJobDetails, viewEarningsByBooking};
