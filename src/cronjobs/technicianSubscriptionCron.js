// jobs/subscription.cron.js
const cron = require('node-cron');
const { expireOverdueSubscriptions } = require('../services/technicianSubscriptionService');

const ENABLE_CRON = 'true'; // bật/tắt bằng env

if (ENABLE_CRON) {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const r = await expireOverdueSubscriptions();
      if (r.updatedSubs || r.updatedTechs) {
        console.log('[subscription-cron]', r);
      }
    } catch (e) {
      console.error('[subscription-cron] error:', e);
    }
  });
  console.log('[subscription-cron] scheduled every 15 minutes');
}

