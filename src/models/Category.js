const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    categoryName: {
        type: String,
        required: true,
        unique: true
    },
    icon: String,
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

categorySchema.index({ categoryName: 1 }, { unique: true });
categorySchema.index({ isActive: 1 });
categorySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Category', categorySchema);
