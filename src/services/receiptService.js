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

module.exports = {
    createReceipt
};
