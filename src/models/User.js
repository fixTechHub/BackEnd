const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userCode: {
        type: String,
        required: true
    },
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String
    },
    phone: {
        type: String
    },
    googleId: {
        type: String
    },
    address: {
        street: String,
        city: String,
        district: String
    },
    avatar: String,
    passwordHash: String,
    phoneVerified: {
        type: Boolean,
        default: false
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    verificationOTP: String,
    otpExpires: Date,
    lockedReason: String,
    role: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'ACTIVE', 'INACTIVE', 'BLOCKED'],
        default: 'PENDING'
    },
    deletedAt: Date,
    verificationCode: String,
    verificationCodeExpires: Date
}, {
    timestamps: true
});

userSchema.index({ userCode: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ phone: 1 }, { unique: true, sparse: true });
userSchema.index({ googleId: 1 }, { sparse: true });
userSchema.index({ status: 1 });
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ deletedAt: 1 }, { sparse: true });

// Kiểm tra xem model đã tồn tại chưa trước khi tạo mới
module.exports = mongoose.models.User || mongoose.model('User', userSchema);
