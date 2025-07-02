const actionLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ActionLog', actionLogSchema);

const bookingSchema = new mongoose.Schema({
    bookingCode: { type: String, required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician' },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    location: { address: { type: String }, geojson: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], required: true } } },
    description: String,
    images: [String],
    schedule: { type: Date, required: true },
    customerConfirmedDone: { type: Boolean, default: false },
    technicianConfirmedDone: { type: Boolean, default: false },
    status: { type: String, enum: ['PENDING', 'QUOTED', 'IN_PROGRESS', 'WAITING_CONFIRM', 'DONE', 'CANCELLED'], default: 'PENDING' },
    statusReason: String,
    isChatAllowed: { type: Boolean, default: false },
    isVideoCallAllowed: { type: Boolean, default: false },
    warrantyExpiresAt: Date,
    completedAt: Date,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'CANCELLED', 'FAILED', 'REFUNDED'], default: 'PENDING' },
    cancellationReason: String
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);

const bookingItemSchema = new mongoose.Schema({
    bookingPriceId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookingPrice', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 1 },
    note: String,
    status: { type: String, enum: ['EXTRA', 'ORIGINAL'], default: 'ORIGINAL' },
    isApprovedByCustomer: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('BookingItem', bookingItemSchema);

const bookingItemLogSchema = new mongoose.Schema({
    bookingItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookingItem', required: true },
    version: { type: Number, required: true },
    action: { type: String, enum: ['CREATED', 'UPDATED', 'DELETED'], required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('BookingItemLog', bookingItemLogSchema);

const bookingPriceSchema = new mongoose.Schema({
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician', required: true },
    commissionConfigId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommissionConfig' },
    laborPrice: { type: Number, required: true },
    status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED'], default: 'PENDING' },
    quotedAt: { type: Date, default: Date.now },
    expiresAt: Date,
    finalPrice: Number,
    warrantiesDuration: { type: Number, default: 30 },
    distance: Number,
    discountCode: String,
    discountValue: { type: Number, default: 0 },
    technicianEarning: Number,
    commissionAmount: Number,
    holdingAmount: Number
}, { timestamps: true });

module.exports = mongoose.model('BookingPrice', bookingPriceSchema);

const bookingPriceLogSchema = new mongoose.Schema({
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician', required: true },
    priceVersion: { type: Number, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED'], required: true },
    note: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BookingPriceLog', bookingPriceLogSchema);

const bookingStatusLogSchema = new mongoose.Schema({
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    fromStatus: { type: String, required: true },
    toStatus: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['CUSTOMER', 'TECHNICIAN', 'SYSTEM', 'ADMIN'], required: true },
    note: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BookingStatusLog', bookingStatusLogSchema);

const bookingWarrantySchema = new mongoose.Schema({
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician', required: true },
    requestDate: { type: Date, required: true },
    reportedIssue: { type: String, required: true },
    isUnderWarranty: { type: Boolean, default: true },
    expireAt: Date,
    status: { type: String, enum: ['PENDING', 'CONFIRMED', 'RESOLVED', 'DENIED'], default: 'PENDING' },
    resolutionNote: String,
    rejectionReason: String,
    isReviewedByAdmin: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('BookingWarranty', bookingWarrantySchema);

const categorySchema = new mongoose.Schema({
    categoryName: { type: String, required: true },
    icon: String,
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);

const certificateSchema = new mongoose.Schema({
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician', required: true },
    fileUrl: { type: String, required: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: Date,
    rejectionReason: String
}, { timestamps: true });

module.exports = mongoose.model('Certificate', certificateSchema);

const commissionConfigSchema = new mongoose.Schema({
    commissionPercent: { type: Number, required: true },
    holdingPercent: { type: Number, required: true },
    commissionMinAmount: { type: Number, default: 0 },
    commissionType: { type: String, enum: ['PERCENT', 'MIN_AMOUNT'], default: 'PERCENT' },
    startDate: { type: Date, required: true },
    isApplied: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('CommissionConfig', commissionConfigSchema);

const contentReportSchema = new mongoose.Schema({
    targetType: { type: String, enum: ['POST', 'COMMENT'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['PENDING', 'REVIEWED', 'REJECTED'], default: 'PENDING' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolutionNote: String,
    resolvedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('ContentReport', contentReportSchema);

const contractSchema = new mongoose.Schema({
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician', required: true },
    contractCode: { type: String, required: true },
    effectiveDate: { type: Date, required: true },
    expirationDate: { type: Date, required: true },
    content: { type: String, required: true },
    signatureImage: String,
    signedAt: Date,
    status: { type: String, enum: ['PENDING', 'SIGNED', 'EXPIRED', 'REJECTED'], default: 'PENDING' }
}, { timestamps: true });

module.exports = mongoose.model('Contract', contractSchema);

const couponSchema = new mongoose.Schema({
    code: { type: String, required: true },
    description: String,
    type: { type: String, enum: ['PERCENT', 'FIXED'], required: true },
    value: { type: Number, required: true },
    maxDiscount: Number,
    minOrderValue: { type: Number, default: 0 },
    totalUsageLimit: { type: Number, default: 1 },
    usedCount: { type: Number, default: 0 },
    audience: { type: String, enum: ['ALL', 'NEW_USER', 'EXISTING_USER', 'SPECIFIC_USERS'], default: 'ALL' },
    userIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isActive: { type: Boolean, default: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);

const couponUsageSchema = new mongoose.Schema({
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    usedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CouponUsage', couponUsageSchema);

const depositLogSchema = new mongoose.Schema({
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician', required: true },
    type: { type: String, enum: ['DEPOSIT', 'WITHDRAW'], required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED'], default: 'PENDING' },
    paymentMethod: { type: String, enum: ['BANK', 'MISA'] },
    paymentGatewayTransactionId: String,
    transactionCode: String,
    balanceBefore: { type: Number, required: true },
    balanceAfter: Number,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    note: String
}, { timestamps: true });

module.exports = mongoose.model('DepositLog', depositLogSchema);

const favoriteTechnicianSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician', required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('FavoriteTechnician', favoriteTechnicianSchema);

const feedbackSchema = new mongoose.Schema({
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    content: String,
    images: [String],
    isVisible: { type: Boolean, default: true },
    hiddenReason: String,
    reply: { content: String, createdAt: Date, updatedAt: Date }
}, { timestamps: true });

module.exports = mongoose.model('Feedback', feedbackSchema);

const messageSchema = new mongoose.Schema({
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    type: { type: String, enum: ['SERVICE', 'SUPPORT', 'GENERAL'], default: 'GENERAL' }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    type: { type: String, enum: ['NEW_REQUEST', 'MESSAGE', 'PAYMENT'], required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    isRead: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);

const receiptSchema = new mongoose.Schema({
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician', required: true },
    receiptCode: { type: String, required: true },
    paymentGatewayTransactionId: String,
    totalAmount: { type: Number, required: true },
    serviceAmount: { type: Number, required: true },
    commissionAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    holdingAmount: { type: Number, default: 0 },
    paidAmount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['BANK', 'CASH', 'MISA'], required: true },
    paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'CANCELLED', 'FAILED', 'REFUNDED'], default: 'PENDING' },
    issuedDate: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Receipt', receiptSchema);

const reportSchema = new mongoose.Schema({
    type: { type: String, enum: ['REPORT', 'VIOLATION'], required: true, default: 'report', },
    reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, },
    description: { type: String, required: true, },
    status: { type: String, enum: ['PENDING', 'CONFIRMED', 'REJECTED', 'RESOLVED', 'CLOSED'], default: 'pending', index: true, },
    penalty: { type: String, default: null, },
    createdAt: { type: Date, default: Date.now, index: true, },
    updatedAt: { type: Date, default: Date.now, },
});

module.exports = mongoose.model('Report', reportSchema);

const roleSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }
}, { timestamps: true });

module.exports = mongoose.model('Role', roleSchema);

const serviceSchema = new mongoose.Schema({
    serviceName: { type: String, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    icon: String,
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);

const systemReportSchema = new mongoose.Schema({
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    tag: { type: String, enum: ['SYSTEM', 'PAYMENT', 'UI', 'OTHER'], required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'], default: 'PENDING' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolutionNote: String,
    resolvedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('SystemReport', systemReportSchema);

const technicianSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    currentLocation: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], required: true } },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
    identification: { type: String, required: true },
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    jobCompleted: { type: Number, default: 0 },
    experienceYears: { type: Number, default: 0 },
    specialtiesCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    availability: { type: String, enum: ['ONJOB', 'FREE', 'BUSY'], default: 'FREE' },
    balance: { type: Number, default: 0 },
    bankAccount: { bankName: String, accountNumber: String, accountHolder: String, branch: String },
    totalEarning: { type: Number, default: 0 },
    totalCommissionPaid: { type: Number, default: 0 },
    totalHoldingAmount: { type: Number, default: 0 },
    totalWithdrawn: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Technician', technicianSchema);

const technicianScheduleSchema = new mongoose.Schema({
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician', required: true },
    scheduleType: { type: String, enum: ['AVAILABLE', 'UNAVAILABLE'], required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    note: String
}, { timestamps: true });

module.exports = mongoose.model('TechnicianSchedule', technicianScheduleSchema);

const userSchema = new mongoose.Schema({
    userCode: { type: String, required: true },
    fullName: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    googleId: { type: String },
    address: { street: String, city: String, district: String },
    avatar: String,
    passwordHash: String,
    phoneVerified: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    lockedReason: String,
    faceScanImage: String,
    role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
    status: { type: String, enum: ['PENDING', 'ACTIVE', 'INACTIVE', 'BLOCKED'], default: 'PENDING' },
    deletedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

const videoCallSchema = new Schema({
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    sessionId: String,
    startedAt: Date,
    endedAt: Date
});

module.exports = mongoose.model('VideoCall', videoCallSchema);