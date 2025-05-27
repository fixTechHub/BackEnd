const mongoose = require('mongoose');
const { Schema } = mongoose;

const serviceSchema = new Schema({
    serviceName: String,
    category: { type: Schema.Types.ObjectId, ref: 'Category' },
    icon: String,
    isActive: Boolean
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
