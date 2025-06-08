const mongoose = require('mongoose');

const systemReportSchema = new mongoose.Schema({
    submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    tag: {
        type: String,
        enum: ['SYSTEM', 'PAYMENT', 'UI', 'OTHER'],
        required: true
    },
    description: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'],
        default: 'PENDING'
    },
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    resolutionNote: String,
    resolvedAt: Date
}, {
    timestamps: true
});

systemReportSchema.index({ status: 1 });
systemReportSchema.index({ submittedBy: 1 });
systemReportSchema.index({ tag: 1 });

module.exports = mongoose.model('SystemReport', systemReportSchema);
