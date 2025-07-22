const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    bookingCode: {
        type: String,
        required: true
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    technicianId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Technician'
    },
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: true
    },
    location: {
        address: {
            type: String
        },
        geojson: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: {
                type: [Number],
                required: true
            }
        }
    },
    description: String,
    images: [String],
    schedule: {
        startTime: {
            type: Date,
        },
        expectedEndTime: {
            type: Date
        }
    },
    isUrgent: { // Trường mới để xác định yêu cầu khẩn cấp
        type: Boolean,
        default: false
    },
    quote: {
        status: {
            type: String,
            enum: ['PENDING', 'ACCEPTED', 'REJECTED']
        },
        commissionConfigId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'CommissionConfig'
        },
        laborPrice: {
            type: Number,
            default: 0
        },
        items: [{
            name: String,
            price: Number,
            quantity: Number,
            note: String
        }],
        totalAmount: { type: Number }, // Tổng tiền thợ đề nghị, chưa giảm giá
        warrantiesDuration: {
            type: Number,
            default: 30
        },
        justification: String, // Lý do nếu giá cao hơn ước tính
        quotedAt: {
            type: Date,
            default: Date.now
        },
    },
    discountCode: String,
    discountValue: {
        type: Number,
        default: 0
    },
    technicianEarning: Number,
    commissionAmount: Number,
    holdingAmount: Number,
    finalPrice: Number,
    customerConfirmedDone: {
        type: Boolean,
        default: false
    },
    technicianConfirmedDone: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['PENDING', 'AWAITING_CONFIRM', 'IN_PROGRESS', 'AWAITING_DONE', 'DONE', 'CANCELLED'],
        default: 'PENDING'
    },
    isChatAllowed: {
        type: Boolean,
        default: false
    },
    isVideoCallAllowed: {
        type: Boolean,
        default: false
    },
    warrantyExpiresAt: Date,
    completedAt: Date,
    cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    cancellationReason: String,
    paymentStatus: {
        type: String,
        enum: ['PENDING', 'PAID', 'CANCELLED', 'FAILED', 'REFUNDED'],
        default: 'PENDING'
    }
}, {
    timestamps: true
}
);

bookingSchema.index({ 'location.geojson': '2dsphere' });

bookingSchema.index({ bookingCode: 1 }, { unique: true });
bookingSchema.index({ status: 1 });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ completedAt: -1 });

bookingSchema.index({ customerId: 1, status: 1 });
bookingSchema.index({ technicianId: 1, status: 1 });
bookingSchema.index({ customerId: 1, createdAt: -1 });
bookingSchema.index({ technicianId: 1, createdAt: -1 });
bookingSchema.index({ status: 1, schedule: 1 });
bookingSchema.index({ status: 1, createdAt: -1 });
bookingSchema.index({ paymentStatus: 1 });

module.exports = mongoose.model('Booking', bookingSchema);