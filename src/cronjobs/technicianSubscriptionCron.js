// jobs/subscription.cron.js
const cron = require('node-cron');
const { expireOverdueSubscriptions } = require('../services/technicianSubscriptionService');

const ENABLE_CRON = 'true'; 
const DAILY_SCHEDULE = '5 0 * * *';

if (ENABLE_CRON) {
  cron.schedule(
    DAILY_SCHEDULE,
    async () => {
    try {
      const r = await expireOverdueSubscriptions();
        if (r.updatedSubs || r.updatedTechs) {
          console.log('[subscription-cron]', r);
        } else {
          console.log('[subscription-cron] no changes');
        }
      } catch (e) {
        console.error('[subscription-cron] error:', e);
      }
    },
    {
      timezone: 'Asia/Ho_Chi_Minh', 
    }
  );
  console.log(`[subscription-cron] scheduled '${DAILY_SCHEDULE}' Asia/Ho_Chi_Minh'`);
}

