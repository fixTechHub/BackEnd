const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
    technicianId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Technician',
        required: true
    },
    contractCode: {
        type: String,
        required: true
    },
    effectiveDate: {
        type: Date,
        required: true
    },
    expirationDate: {
        type: Date,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    signatureImage: String,
    signedAt: Date,
    docusignEnvelopeId: {
        type: String,
        required: true,
        unique: true
    },
    signingUrl: {
        type: String,
    },
    status: {
        type: String,
        enum: ['PENDING', 'SIGNED', 'EXPIRED', 'REJECTED'],
        default: 'PENDING'
    }
}, {
    timestamps: true
});

contractSchema.index({ contractCode: 1 }, { unique: true });
contractSchema.index({ technicianId: 1 });
contractSchema.index({ status: 1 });

module.exports = mongoose.model('Contract', contractSchema);
