const mongoose = require('mongoose');

const actionLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    actionType: { type: String },
    method: { type: String },
    route: { type: String },
    params: { type: Object },
    query: { type: Object },
    body: { type: Object },
    statusCode: { type: Number },
    ip: { type: String },
    userAgent: { type: String },
    description: { type: String },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

actionLogSchema.index({ userId: 1 });
actionLogSchema.index({ createdAt: -1 });
actionLogSchema.index({ statusCode: 1 });

module.exports = mongoose.model('ActionLog', actionLogSchema);
