const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    title: String,
    content: String,
    type: { type: String, enum: ['NEW_REQUEST', 'MESSAGE', 'PAYMENT'] },
    referenceId: mongoose.Schema.Types.ObjectId,
    isRead: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
