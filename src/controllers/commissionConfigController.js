const commissionService = require('../services/commissionService');

// const viewAllCommissionConfigs = async (req, res) => {
//   try {
//     const configs = await commissionService.getAllCommissionConfigs();
//     res.json({ success: true, data: configs });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

const viewAllCommissionConfigs = async (req, res) => {
    try {
        const configs = await commissionService.getAllCommissionConfigs();
        
        if (!configs || configs.length === 0) {
            return res.json({ 
                success: true, 
                data: [],
                message: 'No commission configs found'
            });
        }
        
        res.json({ success: true, data: configs });
    } catch (error) {
        console.error('Error fetching commission configs:', error); // log lỗi
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' // không expose error.message ra ngoài
        });
    }
};

const viewCurrentCommission = async (req, res) => {
  try {
    const current = await commissionService.getCurrentAppliedCommission();
    if (!current) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cấu hình đang áp dụng.' });
    }
    res.json({ success: true, data: current });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const addCommissionConfig = async (req, res) => {
    try {
        const config = await commissionService.createCommissionConfig(req.body);
        res.status(201).json({
            message: 'Commission configuration created successfully.',
            data: config
        });
    } catch (error) {
        console.error('Error adding commission config:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
  viewAllCommissionConfigs,
  viewCurrentCommission,
  addCommissionConfig
};