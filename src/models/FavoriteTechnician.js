const mongoose = require('mongoose');

const favoriteTechnicianSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    technicianId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Technician',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

favoriteTechnicianSchema.index({ customerId: 1 });
favoriteTechnicianSchema.index({ technicianId: 1 });
favoriteTechnicianSchema.index({ customerId: 1, technicianId: 1 }, { unique: true });

module.exports = mongoose.model('FavoriteTechnician', favoriteTechnicianSchema);