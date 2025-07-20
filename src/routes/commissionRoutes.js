const express = require('express');
const router = express.Router();
const commissionController  = require('../controllers/commissionConfigController');

router.get('/', commissionController.viewAllCommissionConfigs);
router.get('/current', commissionController.viewCurrentCommission);
router.post('/', commissionController.addCommissionConfig);

module.exports = router;
