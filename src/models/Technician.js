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
    frontIdImage: { type: String },
    backIdImage: { type: String },
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'INACTIVE', 'PENDING_DELETION', 'DELETED'],
        default: 'PENDING'
    },
    pendingDeletionAt: {
        type: Date
    },
    deletedAt: {
        type: Date
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
    certificate: {
        type: [String],
        default: []
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
    },
    rates: { // Đơn giá do thợ tự cấu hình
        inspectionFee: {
            type: Number,
            required: true
        },
        // Tiền công theo các bậc phức tạp
        laborTiers: {
            // "Giá công từ" sẽ được lấy từ đây
            tier1: { type: Number }, // Sửa chữa đơn giản
            tier2: { type: Number }, // Sửa chữa trung bình
            tier3: { type: Number }  // Sửa chữa phức tạp
        }
    },
    pricesLastUpdatedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

technicianSchema.index({ currentLocation: '2dsphere' });

// Other indexes
technicianSchema.index({ userId: 1 }, { unique: true });
technicianSchema.index({ ratingAverage: -1 });
technicianSchema.index({ specialtiesCategories: 1 });
technicianSchema.index({ createdAt: -1 });

technicianSchema.index({ currentLocation: '2dsphere', availability: 1, status: 1, specialtiesCategories: 1, ratingAverage: -1 });

module.exports = mongoose.model('Technician', technicianSchema);