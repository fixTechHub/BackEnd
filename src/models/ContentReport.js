const mongoose = require('mongoose');

const contentReportSchema = new mongoose.Schema({
    targetType: {
        type: String,
        enum: ['POST', 'COMMENT'],
        required: true
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    reportedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'REVIEWED', 'REJECTED'],
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

contentReportSchema.index({ targetType: 1, targetId: 1 });
contentReportSchema.index({ status: 1 });
contentReportSchema.index({ reportedBy: 1 });

module.exports = mongoose.model('ContentReport', contentReportSchema);
