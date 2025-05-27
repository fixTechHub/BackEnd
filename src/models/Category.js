const mongoose = require('mongoose');
const { Schema } = mongoose;

const categorySchema = new Schema({
    categoryName: String,
    icon: String,
    isActive: Boolean
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
