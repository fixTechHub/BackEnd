// src/constants/subscription.js (FE)  |  backend/constant/subscription.js (BE)
const PAID_PLANS = ['BASIC', 'STANDARD', 'PREMIUM'];
const FREE_TRIAL_LIMIT = 3;

const norm = (s) => String(s || '').toUpperCase();
const isPaidPlan = (tech) => PAID_PLANS.includes(norm(tech?.subscriptionStatus));
const isTrial = (tech) => norm(tech?.subscriptionStatus) === 'TRIAL';
const isFree = (tech) => norm(tech?.subscriptionStatus) === 'FREE';
const underTrialLimit = (tech) => Number(tech?.jobCompleted || 0) < FREE_TRIAL_LIMIT;

// Có được nhận đơn hay không theo rule mới
const canTakeJob = (tech) => {
  if (isPaidPlan(tech)) return true;
  if (isTrial(tech)) return underTrialLimit(tech); // còn quota trial
  // FREE (chưa mua) thì không cho nhận
  return false;
};

module.exports = {
  PAID_PLANS, FREE_TRIAL_LIMIT,
  isPaidPlan, isTrial, isFree, underTrialLimit,
  canTakeJob
};
