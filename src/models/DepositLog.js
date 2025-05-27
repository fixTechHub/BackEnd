const mongoose = require('mongoose');
const { Schema } = mongoose;

const depositLogSchema = new Schema({
    technicianId: { type: Schema.Types.ObjectId, ref: 'Technician' },
    type: { type: String, enum: ['DEPOSIT', 'WITHDRAW'], required: true },
    amount: Number,
    status: { type: String, enum: ['PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED'], default: 'PENDING' },
    transactionCode: String,
    balanceBefore: Number,
    balanceAfter: Number
}, { timestamps: true });

module.exports = mongoose.model('DepositLog', depositLogSchema);
