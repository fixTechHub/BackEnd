const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    serviceName: {
        type: String,
        required: true
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    icon: String,
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

serviceSchema.index({ categoryId: 1 });
serviceSchema.index({ isActive: 1 });
serviceSchema.index({ categoryId: 1, isActive: 1 });
serviceSchema.index({ serviceName: 1 });
serviceSchema.index({ createdAt: -1 });
serviceSchema.index({ serviceName: 1, categoryId: 1 });

module.exports = mongoose.model('Service', serviceSchema);
