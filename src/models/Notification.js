const mongoose = require('mongoose');
const { type } = require('os');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['NEW_REQUEST', 'MESSAGE', 'PAYMENT'],
        required: true
    },
    referenceModel: { type: String, 
        required: function() 
        { return !!this.referenceId; }
        , enum: ['User', 'Payment', 'Message','Booking','Contract','BookingPrice','BookingWarranty'] // Các model có thể tham chiếu }, referenceId: { type: mongoose.Schema.Types.ObjectId, refPath: 'referenceModel' // Tham chiếu động dựa trên trường referenceModel
     },
     url : {
        type: String,
     },
    status: {
        type: String,
        enum: ['DISPLAY', 'DELETED'],
        default: 'DISPLAY'
    },
    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
         refPath: 'referenceModel'
    },
    isRead: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

notificationSchema.index({ userId: 1 });
notificationSchema.index({ isRead: 1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
