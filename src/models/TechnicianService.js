const mongoose = require('mongoose');

const technicianServiceSchema = new mongoose.Schema({
    technicianId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Technician',
        required: true
    },
    // Liên kết đến dịch vụ có giá cố định (serviceType: 'FIXED')
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

technicianServiceSchema.index({ technicianId: 1, serviceId: 1 }, { unique: true });

module.exports = mongoose.model('TechnicianService', technicianServiceSchema);
