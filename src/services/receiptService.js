const Receipt = require('../models/Receipt');
const { generateReceiptCode } = require('../utils/generateCode');
const mongoose = require('mongoose'); // Import mongoose to use ObjectId

const createReceipt = async (receiptData, session) => {
    try {
        const newReceipt = new Receipt({
            ...receiptData,
            receiptCode: await generateReceiptCode(),
            issuedDate: new Date(),
        });

        await newReceipt.save({ session });
        return newReceipt;
    } catch (error) {
        console.error('Error creating receipt:', error);
        throw new Error('Failed to create receipt');
    }
};

const viewUserReceiptsByUserId = async (
    customerId,
    limit,
    skip,
    searchTerm,
    paymentMethod,
    dateFilter,
    customStartDate,
    customEndDate
) => {
    try {
        if (!customerId) {
            throw new Error('Customer ID không tìm thấy');
        }

        // Initial match query for direct fields
        const initialMatch = {
            customerId: new mongoose.Types.ObjectId(customerId), // Ensure customerId is an ObjectId
        };

        // Payment Method Filter
        if (paymentMethod) {
            initialMatch.paymentMethod = paymentMethod.toUpperCase(); // Ensure it matches enum case
        }

        // Date Filter
        if (dateFilter) {
            const now = new Date();
            let startDate;
            let endDate;

            switch (dateFilter) {
                case 'thisWeek':
                    // Start of the current week (Sunday)
                    startDate = new Date(now.setDate(now.getDate() - now.getDay()));
                    startDate.setHours(0, 0, 0, 0);
                    endDate = new Date(startDate);
                    endDate.setDate(startDate.getDate() + 6); // End of the current week (Saturday)
                    endDate.setHours(23, 59, 59, 999);
                    break;
                case 'thisMonth':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    endDate.setHours(23, 59, 59, 999);
                    break;
                case 'custom':
                    if (customStartDate) {
                        startDate = new Date(customStartDate);
                        startDate.setHours(0, 0, 0, 0);
                    }
                    if (customEndDate) {
                        endDate = new Date(customEndDate);
                        endDate.setHours(23, 59, 59, 999);
                    }
                    break;
                default:
                    // No date filter or invalid filter, do nothing
                    break;
            }

            if (startDate || endDate) {
                initialMatch.issuedDate = {};
                if (startDate) {
                    initialMatch.issuedDate.$gte = startDate;
                }
                if (endDate) {
                    initialMatch.issuedDate.$lte = endDate;
                }
            }
        }

        const pipeline = [
            {
                $match: initialMatch, // Apply initial filters
            },
            // Lookup Booking details
            {
                $lookup: {
                    from: 'bookings', // Collection name for 'Booking' model
                    localField: 'bookingId',
                    foreignField: '_id',
                    as: 'bookingId', // Keep the field name as bookingId for frontend consistency
                },
            },
            {
                $unwind: {
                    path: '$bookingId',
                    preserveNullAndEmptyArrays: true, // Keep receipts even if bookingId not found
                },
            },
            // Lookup Service details within Booking
            {
                $lookup: {
                    from: 'services', // Collection name for 'Service' model
                    localField: 'bookingId.serviceId',
                    foreignField: '_id',
                    as: 'bookingId.serviceId',
                },
            },
            {
                $unwind: {
                    path: '$bookingId.serviceId',
                    preserveNullAndEmptyArrays: true,
                },
            },
            // Lookup Customer details within Booking
            {
                $lookup: {
                    from: 'users', // Collection name for 'User' model
                    localField: 'bookingId.customerId',
                    foreignField: '_id',
                    as: 'bookingId.customerId',
                },
            },
            {
                $unwind: {
                    path: '$bookingId.customerId',
                    preserveNullAndEmptyArrays: true,
                },
            },
            // Lookup Technician details within Booking
            {
                $lookup: {
                    from: 'technicians', // Collection name for 'Technician' model
                    localField: 'bookingId.technicianId',
                    foreignField: '_id',
                    as: 'bookingId.technicianId',
                },
            },
            {
                $unwind: {
                    path: '$bookingId.technicianId',
                    preserveNullAndEmptyArrays: true,
                },
            },
        ];

        // Add search term matching AFTER lookups
        if (searchTerm) {
            const searchRegex = new RegExp(searchTerm, 'i');
            pipeline.push({
                $match: {
                    $or: [
                        { receiptCode: searchRegex },
                        { paymentMethod: searchRegex },
                        { 'bookingId.bookingCode': searchRegex }, // Search on populated bookingCode
                    ],
                },
            });
        }

        // Add sorting, skip, and limit for pagination
        pipeline.push(
            {
                $sort: { createdAt: -1 }, // Sort by newest first
            },
            {
                $skip: Number(skip),
            },
            {
                $limit: Number(limit),
            }
        );

        const receipts = await Receipt.aggregate(pipeline);

        return receipts;
    } catch (error) {
        console.error('Error fetching receipts:', error);
        throw new Error('Failed to fetch receipts');
    }
};

module.exports = {
    createReceipt,
    viewUserReceiptsByUserId
};