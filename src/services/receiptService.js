const Receipt = require('../models/Receipt');
const { generateReceiptCode } = require('../utils/generateCode');

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

const viewUserReceiptsByUserId = async (customerId, limit, skip) => {
    try {
        if (!customerId) {
            throw new Error('Customer ID không tìm thấy');
        }
        const receipts = await Receipt.find({ customerId })
            // Sort by newest first
            .skip(Number(skip)) // Add skip for pagination
            .limit(Number(limit))
            .lean()
            .sort({ createdAt: -1 })
            .populate({
                path: 'bookingId',
                populate: [
                    {
                        path: 'serviceId',
                        select: 'serviceName icon',
                    },
                    {
                        path: 'customerId',
                    },
                    {
                        path: 'technicianId',
                    },
                ],
            });
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
