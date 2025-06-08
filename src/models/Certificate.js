const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
    technicianId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Technician',
        required: true
    },
    fileUrl: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED'],
        default: 'PENDING'
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    verifiedAt: Date,
    rejectionReason: String
}, {
    timestamps: true
});

certificateSchema.index({ technicianId: 1 });
certificateSchema.index({ status: 1 });
certificateSchema.index({ verifiedBy: 1 });
certificateSchema.index({ createdAt: -1 });
certificateSchema.index({ technicianId: 1, status: 1 });
certificateSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Certificate', certificateSchema);
