const mongoose = require('mongoose');

const technicianSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    currentLocation: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            required: true
        }
    },
    identification: {
        type: String,
        required: true
    },
    ratingAverage: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    jobCompleted: {
        type: Number,
        default: 0
    },
    experienceYears: {
        type: Number,
        default: 0
    },
    specialtiesCategories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    }],
    availability: {
        type: String,
        enum: ['ONJOB', 'FREE', 'BUSY'],
        default: 'FREE'
    },
    balance: {
        type: Number,
        default: 0
    },
    bankAccount: {
        bankName: String,
        accountNumber: String,
        accountHolder: String,
        branch: String
    },
    totalEarning: {
        type: Number,
        default: 0
    },
    totalCommissionPaid: {
        type: Number,
        default: 0
    },
    totalHoldingAmount: {
        type: Number,
        default: 0
    },
    totalWithdrawn: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// 2dsphere index for geospatial queries
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
