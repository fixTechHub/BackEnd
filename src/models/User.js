const mongoose = require('mongoose');
const { Schema } = mongoose;

const addressSchema = new Schema({
    street: String,
    city: String,
    district: String
}, { _id: false });

const userSchema = new Schema({
    userCode: { type: String, unique: true, required: true, index: true },
    fullName: String,
    email: String,
    phone: { type: Number, unique: true, sparse: true },
    googleId: String,
    address: addressSchema,
    avatar: String,
    passwordHash: String,
    phoneVerified: Boolean,
    emailVerified: Boolean,
    ratingAverage: Number,
    lockedReason: String,
    faceScanVideo: String,
    role: { type: Schema.Types.ObjectId, ref: 'Role' },
    status: { type: String, enum: ['PENDING', 'ACTIVE', 'BLOCKED'], default: 'PENDING' },
    deletedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
