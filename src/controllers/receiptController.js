const receiptService = require('../services/receiptService');

const viewUserReceipt = async (req, res) => {
    try {
      const userId = req.user.userId;
      const {
        limit = 20,
        skip = 0,
        searchTerm,
        paymentMethod,
        dateFilter,
        customStartDate,
        customEndDate,
      } = req.query; // Extract new parameters
  
      const receipts = await receiptService.viewUserReceiptsByUserId(
        userId,
        limit,
        skip,
        searchTerm,
        paymentMethod,
        dateFilter,
        customStartDate,
        customEndDate
      );
      res.status(200).json(receipts);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
module.exports = {
    viewUserReceipt
}