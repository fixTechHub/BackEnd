const mongoose = require('mongoose');

const commissionPackageSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    description: {
        type: String
    },
    benefits: [String], // liệt kê quyền lợi (vd: "Ưu tiên hiển thị", "Hỗ trợ marketing")
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model('CommissionPackage', commissionPackageSchema);
