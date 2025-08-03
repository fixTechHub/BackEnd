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

        const initialMatch = {
            customerId: new mongoose.Types.ObjectId(customerId),
        };

        if (paymentMethod) {
            initialMatch.paymentMethod = paymentMethod.toUpperCase();
        }

        if (dateFilter) {
            const now = new Date();
            let startDate, endDate;

            switch (dateFilter) {
                case 'thisWeek':
                    startDate = new Date(now.setDate(now.getDate() - now.getDay()));
                    startDate.setHours(0, 0, 0, 0);
                    endDate = new Date(startDate);
                    endDate.setDate(startDate.getDate() + 6);
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
            }

            if (startDate || endDate) {
                initialMatch.issuedDate = {};
                if (startDate) initialMatch.issuedDate.$gte = startDate;
                if (endDate) initialMatch.issuedDate.$lte = endDate;
            }
        }

        const pipeline = [
            { $match: initialMatch },

            // Lookup Booking
            {
                $lookup: {
                    from: 'bookings',
                    localField: 'bookingId',
                    foreignField: '_id',
                    as: 'bookingId',
                },
            },
            {
                $unwind: {
                    path: '$bookingId',
                    preserveNullAndEmptyArrays: true,
                },
            },

            // Lookup Service from booking.serviceId
            {
                $lookup: {
                    from: 'services',
                    localField: 'bookingId.serviceId',
                    foreignField: '_id',
                    as: 'service',
                },
            },
            {
                $unwind: {
                    path: '$service',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $addFields: {
                    'bookingId.serviceId': '$service',
                },
            },

            // Lookup Customer (receipt.customerId)
            {
                $lookup: {
                    from: 'users',
                    localField: 'customerId',
                    foreignField: '_id',
                    as: 'customer',
                },
            },
            {
                $unwind: {
                    path: '$customer',
                    preserveNullAndEmptyArrays: true,
                },
            },

            // Lookup Technician (receipt.technicianId)
            {
                $lookup: {
                    from: 'technicians',
                    localField: 'technicianId',
                    foreignField: '_id',
                    as: 'technician',
                },
            },
            {
                $unwind: {
                    path: '$technician',
                    preserveNullAndEmptyArrays: true,
                },
            },

            // Lookup Technician's User (technician.userId)
            {
                $lookup: {
                    from: 'users',
                    let: { userId: '$technician.userId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$_id', '$$userId'] },
                            },
                        },
                    ],
                    as: 'technician.user',
                },
            },
            {
                $unwind: {
                    path: '$technician.user',
                    preserveNullAndEmptyArrays: true,
                },
            },
        ];

        // Search term
        if (searchTerm) {
            const searchRegex = new RegExp(searchTerm, 'i');
            pipeline.push({
                $match: {
                    $or: [
                        { receiptCode: searchRegex },
                        { paymentMethod: searchRegex },
                        { 'bookingId.bookingCode': searchRegex },
                    ],
                },
            });
        }

        // Pagination & Sorting
        pipeline.push(
            { $sort: { createdAt: -1 } },
            { $skip: Number(skip) },
            { $limit: Number(limit) }
        );

        const receipts = await Receipt.aggregate(pipeline);
        console.log(receipts);
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