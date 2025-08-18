// src/constants/subscription.js
const PAID_PLANS = ['BASIC', 'STANDARD', 'PREMIUM'];
const FREE_TRIAL_LIMIT = 3;

const isPaidPlan = (tech) =>
  PAID_PLANS.includes(String(tech?.subscriptionStatus || '').toUpperCase());

const underTrialLimit = (tech) => Number(tech?.jobCompleted || 0) < FREE_TRIAL_LIMIT;

module.exports = { PAID_PLANS, FREE_TRIAL_LIMIT, isPaidPlan, underTrialLimit };
