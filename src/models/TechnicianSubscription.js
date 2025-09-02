const mongoose = require('mongoose');

const technicianSubscriptionSchema = new mongoose.Schema({
  technician: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician', required: true },
  package:    { type: mongoose.Schema.Types.ObjectId, ref: 'CommissionPackage', required: true },
  startDate:  { type: Date, default: Date.now },
  endDate:    { type: Date, required: true },
  status:     { type: String, enum: ['ACTIVE', 'EXPIRED', 'CANCELLED'], default: 'ACTIVE' },
  paymentHistory: [{
    amount: Number,
    paidAt: Date,
    method: {
      type: String,
      enum: ['BALANCE', 'BANK_TRANSFER', 'BANK'],
      default: 'BALANCE'
    }
  }]
}, { timestamps: true });

technicianSubscriptionSchema.index({ technician: 1, status: 1 });
technicianSubscriptionSchema.index({ endDate: 1, status: 1 });

// ✅ Dòng export “an toàn” cho Next.js/Vercel/Hot reload:
module.exports =
  mongoose.models.TechnicianSubscription ||
  mongoose.model('TechnicianSubscription', technicianSubscriptionSchema);
