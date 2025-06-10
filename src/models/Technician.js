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
    jobCompleted: Number,
    specialties: String,
    availability: { type: String, enum: ['ONJOB', 'FREE'], default: 'FREE' },
    contractAccepted: Boolean,
    balance: Number,
    technicianActive: Boolean,
    depositHistory: [{ type: Schema.Types.ObjectId, ref: 'DepositLog' }],
    bankAccount: bankAccountSchema
}, { timestamps: true });

technicianSchema.index({ currentLocation: '2dsphere' });

// Other indexes
technicianSchema.index({ userId: 1 }, { unique: true });
technicianSchema.index({ ratingAverage: -1 });
technicianSchema.index({ specialtiesCategories: 1 });
technicianSchema.index({ createdAt: -1 });

// Compound indexes for common queries
technicianSchema.index({ availability: 1, ratingAverage: -1 });
technicianSchema.index({ specialtiesCategories: 1, availability: 1 });
technicianSchema.index({ currentLocation: '2dsphere', availability: 1 });

module.exports = mongoose.model('Technician', technicianSchema);
