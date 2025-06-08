const mongoose = require('mongoose');
const { Schema } = mongoose;

const bankAccountSchema = new Schema({
    bankName: String,
    accountNumber: String,
    accountHolder: String,
    branch: String
}, { _id: false });

const technicianSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    currentLocation: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }
    },
    identification: Number,
    certificate: [String],
    certificateVerificationStatus: Boolean,
    isApproved: Boolean,
    jobCompleted: Number,
    specialties: String,
    availability: { type: String, enum: ['ONJOB', 'FREE'], default: 'FREE' },
    contractAccepted: Boolean,
    contractSignature:String,
    balance: Number,
    isAvailableForAssignment: Boolean,
    bankAccount: bankAccountSchema,
    isBanned: Boolean,
    bannedReason:String
}, { timestamps: true });

technicianSchema.index({ currentLocation: '2dsphere' });

module.exports = mongoose.model('Technician', technicianSchema);
