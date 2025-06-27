const receiptService = require('../services/receiptService');

const viewUserReceipt = async (req,res) => {
    try {
        const userId = req.user.userId
        const receipts = await receiptService.viewUserReceiptsByUserId(userId)
        res.status(200).json(receipts);
    } catch (error) {
    res.status(500).json({ message: error.message });
    }
}
module.exports = {
    viewUserReceipt
}