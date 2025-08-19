const Technician = require('../models/Technician');
const { isPaidPlan, underTrialLimit, FREE_TRIAL_LIMIT } = require('../constant/subscription');

module.exports = async function trialGate(req, res, next) {
  try {
    // 1) Lấy tech theo thứ tự ưu tiên: params -> token.technicianId -> token.user._id
    const paramTechId = req.params.techId;
    const tokenTechId = req.user?.technicianId;
    const tokenUserId = req.user?.userId || req.user?._id; 

    let tech = null;

    if (paramTechId) {
      tech = await Technician.findById(paramTechId).select('subscriptionStatus jobCompleted userId');
    } else if (tokenTechId) {
      tech = await Technician.findById(tokenTechId).select('subscriptionStatus jobCompleted userId');
    } else if (tokenUserId) {
      tech = await Technician.findOne({ userId: tokenUserId }).select('subscriptionStatus jobCompleted userId');
    }

    if (!tech) {
      return res.status(404).json({ message: 'Technician not found' });
    }

    // 2) Cho qua nếu đã có gói trả phí
    if (isPaidPlan(tech)) return next();

    // 3) FREE/TRIAL: còn quota dùng thử?
    if (underTrialLimit(tech)) return next();

    // 4) Hết trial
    return res.status(403).json({
      code: 'TRIAL_LIMIT_REACHED',
      message: `Bạn đã dùng hết ${FREE_TRIAL_LIMIT} đơn dùng thử. Vui lòng đăng ký gói để tiếp tục nhận việc.`,
      data: {
        subscriptionStatus: tech.subscriptionStatus,
        jobCompleted: tech.jobCompleted,
        trialLimit: FREE_TRIAL_LIMIT
      }
    });
  } catch (err) {
    next(err);
  }
};
